// DATA MENGGUNAKAN ARRAY
const USER_GURU = "admin"; //usn admin
const PIN_GURU = "admin123"; //pwnya
const KUNCI_KUIS = "kuisseru3_kuis";
const KUNCI_HASIL = "kuisseru3_hasil";
const AVATAR = ["🦊", "🐼", "🐸", "🦄", "🐯", "🐙", "🦉", "🐧"];
const SIMBOL = ["▲", "◆", "●", "■"];

//example soal
const kuisAwal = [{
  kode: "MATH01", judul: "MATEMATIKA X_X",
  soal: [
    { id: 1, pertanyaan: "Berapa hasil 7 x 8?", pilihan: ["54", "56", "64", "48"], benar: 1, waktu: 20 },
    { id: 2, pertanyaan: "Berapa hasil 100 - 37?", pilihan: ["63", "73", "67", "53"], benar: 0, waktu: 20 },
    { id: 3, pertanyaan: "Berapa hasil 9 x 9?", pilihan: ["72", "81", "90", "99"], benar: 1, waktu: 20 },
    { id: 4, pertanyaan: "Berapa hasil 144 : 12?", pilihan: ["10", "11", "12", "14"], benar: 2, waktu: 20 },
    { id: 5, pertanyaan: "Berapa hasil 15 + 28?", pilihan: ["43", "44", "42", "53"], benar: 0, waktu: 20 },
    { id: 6, pertanyaan: "Berapa hasil 12 x 6?", pilihan: ["62", "72", "66", "76"], benar: 1, waktu: 20 },
    { id: 7, pertanyaan: "Berapa hasil 200 - 85?", pilihan: ["105", "125", "115", "135"], benar: 2, waktu: 20 },
    { id: 8, pertanyaan: "Berapa hasil 81 : 9?", pilihan: ["8", "9", "7", "11"], benar: 1, waktu: 20 },
    { id: 9, pertanyaan: "Berapa hasil 25 x 4?", pilihan: ["80", "90", "110", "100"], benar: 3, waktu: 20 },
    { id: 10, pertanyaan: "Berapa hasil 3 x 3 x 3?", pilihan: ["9", "18", "27", "36"], benar: 2, waktu: 20 },
  ],
}];

const muat = (kunci, cadangan) => {
  try { return JSON.parse(localStorage.getItem(kunci)) || cadangan; }
  catch { return cadangan; }
};
const simpan = (kunci, data) => localStorage.setItem(kunci, JSON.stringify(data));

let daftarKuis = muat(KUNCI_KUIS, kuisAwal);

daftarKuis.forEach((k) => { if (k.kode === "MATH01" && k.soal.length === 4) k.soal = kuisAwal[0].soal; });
simpan(KUNCI_KUIS, daftarKuis);
let semuaHasil = muat(KUNCI_HASIL, []);       // laporan hasil akhir
let kuisEdit = null;   // kuis edit admin
let ruang = null;      // state ruangan di admin
let saya = null;       // data user only
let kanal = null;      // BroadcastChannel only tab
let peer = null;       // objek PeerJS all device
let koneksi = [];      // admin ke useer, user ke admin
let klienMqtt = null;  // klien MQTT (relay lewat broker publik)
let topikKirim = null; // topik tujuan pengiriman MQTT
let jaringan = {};     // status jalur jaringan (untuk ditampilkan ke guru)
const BROKER = "wss://broker.emqx.io:8084/mqtt";
let timerRuang = null; // timer milik guru
let timerIntro = null; // timer hitung mundur
let timeoutCek = null; // timeout pengecekan PIN

//FUNGSI BANTU
const $ = (id) => document.getElementById(id);

// Membuat elemen dengan textContent
// kelas gerak0..gerak7
const karakter = (a) => buatEl("span", `kar gerak${Math.max(0, AVATAR.indexOf(a))}`, a);
const setKarakter = (el, a) => { el.textContent = a; el.className = `kar gerak${Math.max(0, AVATAR.indexOf(a))}`; };

const buatEl = (tag, kelas, teks) => {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
};

// Menampilkan satu layar dan hide yang lain
const tampilkan = (idLayar) => {
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== idLayar));
  if (idLayar !== "live-siswa") { clearInterval(timerIntro); $("intro").hidden = true; }
  document.body.dataset.view = idLayar;
  Efek.layar(idLayar, !!ruang);
  if (idLayar === "guru-panel") renderDaftarKuis();
};

// Urutkan pemain dari skor tertinggi
const urutkan = (pemain) => [...pemain].sort((a, b) => b.skor - a.skor);

// Keluar dari ruangan untuk hentikan timer, tutup kanal, reset state
const keluar = () => {
  clearInterval(timerRuang);
  clearTimeout(timeoutCek);
  if (kanal) kanal.close();
  if (peer) peer.destroy();
  if (klienMqtt) klienMqtt.end(true);
  klienMqtt = null; topikKirim = null;
  kanal = null; peer = null; koneksi = []; ruang = null; saya = null;
};

// Kirim pesan lewat dua jalur antar tab dan antar device
const kirim = (msg) => {   
  if (kanal) kanal.postMessage(msg);
  koneksi.forEach((c) => { if (c.open) c.send(msg); });
  if (klienMqtt && klienMqtt.connected) klienMqtt.publish(topikKirim, JSON.stringify(msg));
};

// Semua tombol dengan data-view berpindah layar
document.querySelectorAll("[data-view]").forEach((btn) =>
  btn.addEventListener("click", () => { keluar(); tampilkan(btn.dataset.view); })
);

// Leaderboard ke elemen <ol>
const isiPeringkat = (ol, pemain, idSaya, batas = 10, mulai = 0) => {
  ol.innerHTML = "";
  ol.hidden = pemain.length <= mulai;
  const medali = ["🥇", "🥈", "🥉"];
  urutkan(pemain).slice(mulai, mulai + batas).forEach((p, idx) => {
    const i = idx + mulai;
    const li = buatEl("li", p.id === idSaya ? "saya" : "");
    li.append(buatEl("span", "", `${medali[i] || i + 1 + "."} ${p.avatar} ${p.nama}${p.streak >= 3 ? ` 🔥${p.streak}` : ""}`));
    li.append(buatEl("span", "", `${p.skor} poin`));
    ol.append(li);
  });
};

// podium 123
const isiPodium = (pemain, idSaya) => {
  const wadah = $("podium");
  wadah.innerHTML = "";
  const top = urutkan(pemain).slice(0, 3);
  wadah.hidden = top.length === 0;
  [1, 0, 2].forEach((r) => {
    const p = top[r];
    if (!p) return;
    const kol = buatEl("div", `juara juara${r + 1}${p.id === idSaya ? " saya" : ""}`);
    if (r === 0) kol.append(buatEl("div", "mahkota", "👑"));
    const kar = karakter(p.avatar);
    kar.classList.add("kar-juara");
    kol.append(kar, buatEl("div", "juara-nama", p.nama), buatEl("div", "juara-skor", `${p.skor} poin`));
    kol.append(buatEl("div", "juara-blok", ["🥇", "🥈", "🥉"][r] + " " + (r + 1)));
    wadah.append(kol);
  });
};

// waiting room only user and admin
const renderLobi = (s, sebagaiGuru) => {
  const pin = sebagaiGuru ? ruang.pin : saya.pin;
  $("lobi-pin").textContent = pin.slice(0, 3) + " " + pin.slice(3); // 295 222
  if (!sebagaiGuru) { 
    setKarakter($("lobi-avatar"), saya.avatar);
    $("lobi-nama").textContent = saya.nama; 
  }
  $("lobi-judul").textContent = s.judul;
  $("lobi-guru").hidden = !sebagaiGuru;
  $("lobi-siswa").hidden = sebagaiGuru;
  $("jumlah-pemain").textContent = s.pemain.length;
  $("btn-mulai").disabled = s.pemain.length === 0;
  const ul = $("daftar-pemain");
  ul.innerHTML = "";
  s.pemain.forEach((p) => {
    const li = buatEl("li", "pemain");
    li.append(karakter(p.avatar), buatEl("span", "", p.nama));
    ul.append(li);
  });
};

// UNTUK ADMIN
$("lihat-pass").addEventListener("change", (e) => { $("pin").type = e.target.checked ? "text" : "password"; });

$("form-login").addEventListener("submit", (e) => {
  e.preventDefault();
  if ($("user").value.trim().toLowerCase() === USER_GURU && $("pin").value === PIN_GURU) { // percabangan: cek username + password
    $("pesan-login").textContent = "";
    $("pin").value = "";
    $("user").value = "";
    $("lihat-pass").checked = false; $("pin").type = "password";
    kuisEdit = null;
    $("editor").hidden = true;
    tampilkan("guru-panel");
  } else {
    $("pesan-login").textContent = "Username atau password salah, coba lagi.";
  }
});

// Daftar kuis dan tombol Mainkan / Edit / Laporan / Hapus
const renderDaftarKuis = () => {
  const ul = $("daftar-kuis");
  ul.innerHTML = "";
  daftarKuis.forEach((k) => {
    const li = buatEl("li");
    li.append(buatEl("strong", "", `${k.judul} (${k.soal.length} soal)`));
    const aksi = buatEl("div", "aksi");
    const tombol = [
      ["▶ Mainkan", "biru", () => bukaRuangan(k)],
      ["Edit", "biru", () => bukaEditor(k)],
      ["Laporan", "biru", () => bukaLaporan(k)],
      ["Hapus", "", () => hapusKuis(k.kode)],
    ];
    tombol.forEach(([teks, kelas, fn]) => {
      const b = buatEl("button", kelas, teks);
      b.addEventListener("click", fn);
      aksi.append(b);
    });
    li.append(aksi);
    ul.append(li);
  });
};

// id create 
const buatKode = () => {
  let kode;
  do {
    kode = Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  while (daftarKuis.some((k) => k.kode === kode));
  return kode;
};

$("form-kuis").addEventListener("submit", (e) => {
  e.preventDefault();
  daftarKuis.push({ kode: buatKode(), judul: $("judul-kuis").value.trim(), soal: [] });
  simpan(KUNCI_KUIS, daftarKuis);
  e.target.reset();
  renderDaftarKuis();
});

const hapusKuis = (kode) => {
  if (!confirm("Hapus kuis ini beserta hasilnya?")) return;
  daftarKuis = daftarKuis.filter((k) => k.kode !== kode);
  semuaHasil = semuaHasil.filter((h) => h.kode !== kode);
  simpan(KUNCI_KUIS, daftarKuis);
  simpan(KUNCI_HASIL, semuaHasil);
  if (kuisEdit && kuisEdit.kode === kode) { 
    kuisEdit = null;
    $("editor").hidden = true;
  }
  renderDaftarKuis();
};

// Editor soal
const bukaEditor = (kuis) => {
  kuisEdit = kuis;
  $("editor").hidden = false;
  $("judul-editor").textContent = kuis.judul;
  renderDaftarSoal();
};

const renderDaftarSoal = () => {
  const ul = $("daftar-soal");
  ul.innerHTML = "";
  kuisEdit.soal.forEach((s) => {
    const li = buatEl("li");
    li.append(buatEl("span", "", s.pertanyaan));
    const hapus = buatEl("button", "", "Hapus");
    hapus.addEventListener("click", () => {
      kuisEdit.soal = kuisEdit.soal.filter((x) => x.id !== s.id);
      simpan(KUNCI_KUIS, daftarKuis);
      renderDaftarSoal();
    });
    li.append(hapus);
    ul.append(li);
  });
};

$("form-soal").addEventListener("submit", (e) => {
  e.preventDefault();
  kuisEdit.soal.push({
    id: Date.now(),
    pertanyaan: $("tanya").value.trim(),
    pilihan: [...document.querySelectorAll(".opsi")].map((i) => i.value.trim()),
    benar: Number(document.querySelector('input[name="benar"]:checked').value),
    waktu: Number($("waktu").value),
  });
  simpan(KUNCI_KUIS, daftarKuis);
  e.target.reset();
  renderDaftarSoal();
});

// Ruangan live
// Admin membuka room buat PIN, buka kanal, tampilkan ruang tunggu
const bukaRuangan = (kuis) => {
  if (kuis.soal.length === 0) { alert("Kuis ini belum punya soal."); return; }
  keluar();
  ruang = {
    pin: String(100000 + Math.floor(Math.random() * 900000)),
    kuis, status: "lobi", index: -1, sisa: 0, dijeda: false,
    pemain: [], distribusi: [0, 0, 0, 0], tampilIndex: -2,
  };
  kanal = new BroadcastChannel("kuisseru");
  kanal.onmessage = (e) => terimaGuru(e.data);
  jaringan = { peer: "⏳", relay: "⏳" };
  siapkanPeerGuru(ruang.pin);
  sambungMqtt(ruang.pin, true, terimaGuru, (ok) => { jaringan.relay = ok ? "✅" : "⚠️"; tampilStatus(); });
  tampilkan("lobi");
  siarkan();
};

// Menampilkan status jaringan di ruang tunggu admin
const tampilStatus = () => {
  const online = Object.values(jaringan).includes("✅");
  $("status-jaringan").textContent =
    (online ? "✅ Online - User dari perangkat lain bisa bergabung." : "⏳ Menghubungkan ke Room...") +
    ` (Relay: ${jaringan.relay} | P2P: ${jaringan.peer})`;
};

// Jalur relay terhubung ke broker MQTT publik lewat WebSocket.
// Admin mendengar topik "user", user mendengar topik "state".
const sambungMqtt = (pin, sebagaiGuru, onData, onStatus) => {
  if (typeof mqtt === "undefined") { 
    onStatus(false); 
    return; 
  }
  const dasar = `kuisseru-v1/${pin}/`;
  topikKirim = dasar + (sebagaiGuru ? "state" : "siswa");
  const topikTerima = dasar + (sebagaiGuru ? "siswa" : "state");
  klienMqtt = mqtt.connect(BROKER, { reconnectPeriod: 3000, connectTimeout: 8000 });
  klienMqtt.on("connect", () => klienMqtt.subscribe(topikTerima, () => onStatus(true)));
  klienMqtt.on("close", () => onStatus(false));
  klienMqtt.on("error", () => onStatus(false));
  klienMqtt.on("message", (topik, isi) => {
    try { onData(JSON.parse(isi.toString())); } catch { /* abaikan pesan rusak */ }
  });
};

// Jalur P2P user mendaftar ke server PeerJS dengan id berdasarkan PIN
const siapkanPeerGuru = (pin) => {
  if (typeof Peer === "undefined") { jaringan.peer = "tidak termuat"; tampilStatus(); return; }
  tampilStatus();
  peer = new Peer("kuisseru-" + pin);
  peer.on("open", () => { jaringan.peer = "✅"; tampilStatus(); });
  peer.on("error", (err) => { jaringan.peer = `⚠️ ${err.type}`; tampilStatus(); });
  peer.on("connection", (c) => {
    koneksi.push(c);
    c.on("data", terimaGuru);
    c.on("close", () => { koneksi = koneksi.filter((x) => x !== c); });
  });
};

// "publik" yang dikirim ke user TANPA kunci jawaban sebelum waktunya
const keadaan = () => {
  const s = ruang.kuis.soal[ruang.index];
  const buka = ["hasil", "selesai"].includes(ruang.status);
  return {
    status: ruang.status, judul: ruang.kuis.judul, index: ruang.index,
    total: ruang.kuis.soal.length,
    soal: s && ruang.status !== "selesai" ? { pertanyaan: s.pertanyaan, pilihan: s.pilihan, waktu: s.waktu } : null,
    sisa: ruang.sisa, dijeda: ruang.dijeda,
    benar: buka && s ? s.benar : null,
    distribusi: ruang.distribusi,
    pemain: ruang.pemain.map((p) => ({
      id: p.id, nama: p.nama, avatar: p.avatar, skor: p.skor, streak: p.streak,
      sudahJawab: p.jawab !== null, benar: p.benar, poin: p.poin,
    })),
  };
};

// SIARKAN KEADAAN ROOM KE SEMUA SISWA DAN TAB LAIN

const siarkan = () => {
  kirim({
    pin: ruang.pin,
    tipe: "state",
    s: keadaan()
  });

  renderGuru();
};

// MENERIMA PESAN DARI USER

const terimaGuru = (msg) => {
  if (!ruang || msg.pin !== ruang.pin) return;

  const p = ruang.pemain.find((x) => x.id === msg.id);

  // User mengecek apakah ruangan tersedia
  if (msg.tipe === "cek") {
    siarkan();

  // USER bergabung ke ruangan
  } else if (msg.tipe === "gabung") {
    if (ruang.status === "lobi" && !p) {
      ruang.pemain.push({
        id: msg.id,
        nama: msg.nama,
        avatar: msg.avatar,
        skor: 0,
        streak: 0,
        jawab: null,
        benar: null,
        poin: 0,
        detail: []
      });
    }

    siarkan();

  // User mengirim jawaban
  } else if (msg.tipe === "jawab") {

    // Jawaban hanya diterima ketika
    // 1. User terdaftar
    // 2. Status sedang mengerjakan soal
    // 3. Tidak sedang dijeda
    // 4. User belum menjawab
    // 5. Index soal sesuai
    if (
      !p ||
      ruang.status !== "soal" ||
      ruang.dijeda ||
      p.jawab !== null ||
      msg.index !== ruang.index
    ) {
      return;
    }

    prosesJawaban(p, msg.pilihan);
  }
};

// BONUS STREAK

const bonusStreak = (n) => {
  return n >= 3
    ? Math.min(n - 2, 5) * 100
    : 0;
};

// TAMPILKAN ANIMASI STREAK
const tampilStreak = (n) => {
  const pop = $("streak-pop");

  $("streak-teks").textContent = `Streak ${n}!`;
  $("streak-bonus").textContent = `Bonus +${bonusStreak(n)} poin`;

  pop.hidden = false;

  Efek.streak();
  Efek.konfeti(120, "ledak");

  pop.classList.remove("jalan");
  void pop.offsetWidth;
  pop.classList.add("jalan");

  setTimeout(() => {
    pop.hidden = true;
  }, 2200);
};

// PROSES JAWABAN USER
// Menghitung skor berdasarkan kecepatan menjawab
// ples tambahan bonus streak.
const prosesJawaban = (p, pilihan) => {
  const s = ruang.kuis.soal[ruang.index];

  const benar = pilihan === s.benar;

  p.jawab = pilihan;

  // Menambah jumlah pilihan jawaban
  ruang.distribusi[pilihan]++;

  p.benar = benar;

  if (benar) {
    // Tambah streak jika jawaban benar
    p.streak++;

    // Hitung poin berdasarkan kecepatan + bonus streak
    p.poin =
      Math.round(
        500 + 500 * (ruang.sisa / s.waktu)
      ) + bonusStreak(p.streak);

    p.skor += p.poin;

  } else {
    // kalau salah, streak dan poin direset
    p.streak = 0;
    p.poin = 0;
  }

  // Simpan detail jawaban
  p.detail.push({
    id: s.id,
    benar: benar
  });

  // Jika semua user sudah menjawab,
  // soal langsung diakhiri.
  if (ruang.pemain.every((x) => x.jawab !== null)) {
    akhiriSoal();
  } else {
    siarkan();
  }
};

// MULAI SOAL BERIKUTNYA

const mulaiSoal = () => {
  ruang.status = "soal";
  ruang.index++;

  ruang.sisa = ruang.kuis.soal[ruang.index].waktu;
  ruang.dijeda = false;

  ruang.distribusi = [0, 0, 0, 0];

  // Reset jawaban setiap user
  ruang.pemain.forEach((p) => {
    p.jawab = null;
    p.benar = null;
    p.poin = 0;
  });

  // Hentikan timer sebelumnya
  clearInterval(timerRuang);

  let terakhir = Date.now();

  // Jalankan timer
  timerRuang = setInterval(() => {
    const sekarang = Date.now();

    // Saat tidak dijeda, waktu terus berkurang
    if (!ruang.dijeda) {
      ruang.sisa -= (sekarang - terakhir) / 1000;

      // Jika waktu habis
      if (ruang.sisa <= 0) {
        ruang.sisa = 0;
        akhiriSoal();
        return;
      }
    }

    terakhir = sekarang;

    // Kirim keadaan terbaru
    siarkan();

  }, 250);

  siarkan();
};

// TUTUP SOAL

// User yang belum menjawab dianggap salah.
const tutupSoal = () => {
  clearInterval(timerRuang);

  ruang.status = "hasil";

  const s = ruang.kuis.soal[ruang.index];

  ruang.pemain.forEach((p) => {
    if (p.jawab === null) {
      p.benar = false;
      p.streak = 0;
      p.poin = 0;

      p.detail.push({
        id: s.id,
        benar: false
      });
    }
  });
};


// AKHIRI SOAL

const akhiriSoal = () => {
  tutupSoal();
  siarkan();
};

// SELESAI KUIS

// Menyimpan hasil setiap user untuk laporan.
const selesaiKuis = () => {
  // Jika kuis sudah selesai, hentikan proses
  if (ruang.status === "selesai") return;

  // Jika masih mengerjakan soal,
  // tutup soal terlebih dahulu.
  if (ruang.status === "soal") {
    tutupSoal();
  }

  clearInterval(timerRuang);

  ruang.status = "selesai";

  // Simpan hasil setiap user
  ruang.pemain.forEach((p) => {
    semuaHasil.push({
      kode: ruang.kuis.kode,
      nama: p.nama,
      avatar: p.avatar,
      skor: p.skor,

      benar: p.detail.filter((d) => d.benar).length,

      total: p.detail.length,

      detail: p.detail
    });
  });

  // Simpan hasil ke penyimpanan
  simpan(KUNCI_HASIL, semuaHasil);

  // Kirim keadaan terbaru
  siarkan();
};

// TOMBOL KONTROL ADMIN

// btn mulai soal
$("btn-mulai").addEventListener("click", mulaiSoal);

// btn jeda / lanjutkan soal
$("btn-jeda").addEventListener("click", () => {
  ruang.dijeda = !ruang.dijeda;
  siarkan();
});

// btn akhiri soal
$("btn-akhiri-soal").addEventListener("click", akhiriSoal);

// btn lanjut ke soal berikutnya
$("btn-lanjut").addEventListener("click", () => {
  if (ruang.index + 1 < ruang.kuis.soal.length) {
    mulaiSoal();
  } else {
    selesaiKuis();
  }
});

// btn akhiri seluruh kuis
$("btn-akhiri-kuis").addEventListener("click", () => {
  if (confirm("Akhiri kuis sekarang?")) {
    selesaiKuis();
  }
});

// MENAMPILKAN LAYAR ADMIN SESUAI STATUS RUANGAN

// Menggambar layar admin sesuai status ruangan
const renderGuru = () => {
  const s = keadaan();

  // Jika masih berada di lobi
  if (ruang.status === "lobi") {
    renderLobi(s, true);
    return;
  }

  // Jika kuis sudah selesai
  if (ruang.status === "selesai") {
    $("hasil-akhir").textContent =
      "Kuis selesai! Hasil tersimpan di menu Laporan.";

    isiPodium(s.pemain, null);

    isiPeringkat(
      $("daftar-skor"),
      s.pemain,
      null,
      10,
      3
    );

    tampilkan("papan");
    return;
  }

  // Menampilkan layar kuis yang sedang berlangsung
  tampilkan("live-guru");

  const hasil = ruang.status === "hasil";

  // Jika soal selesai, bunyikan bel satu kali
  if (hasil && ruang.bel !== ruang.index) {
    ruang.bel = ruang.index;
    Efek.bel();
  }

  // MEMBUAT PILIHAN JAWABAN

  // Kotak pilihan hanya dibuat sekali untuk setiap soal
  if (ruang.tampilIndex !== ruang.index) {
    ruang.tampilIndex = ruang.index;

    $("g-teks").textContent = s.soal.pertanyaan;

    const wadah = $("g-tiles");

    wadah.innerHTML = "";

    s.soal.pilihan.forEach((teks, i) => {
      const b = buatEl(
        "button",
        "opsi-btn",
        `${SIMBOL[i]} ${teks}`
      );

      b.disabled = true;

      b.append(
        buatEl("span", "jumlah", "")
      );

      wadah.append(b);
    });
  }

  // MENAMPILKAN HASIL JAWABAN
  // - Jawaban benar diberi tanda
  // - Jawaban salah diberi tanda
  // - Jumlah pemilih setiap opsi ditampilkan
  document
    .querySelectorAll("#g-tiles .opsi-btn")
    .forEach((b, i) => {

      if (hasil) {
        b.classList.add(
          i === s.benar ? "benar" : "salah"
        );

        b.querySelector(".jumlah").textContent =
          s.distribusi[i];
      }
    });
};

// INFORMASI SOAL DI LAYAR ADMIN

const terjawab = s.pemain.filter((p) => p.sudahJawab).length;

// Menampilkan nomor soal
$("g-nomor").textContent =
  `Soal ${s.index + 1}/${s.total}`;

// Menampilkan jumlah user yang sudah menjawab
$("g-jawab").textContent =
  `${terjawab}/${s.pemain.length} sudah menjawab`;

// Menampilkan sisa waktu
$("g-sisa").textContent = s.dijeda
  ? "⏸ Dijeda"
  : `⏱ ${Math.ceil(s.sisa)}`;

// Mengatur panjang progress bar waktu
$("g-bar").style.width =
  `${(s.sisa / s.soal.waktu) * 100}%`;

// TOMBOL KONTROL SOAL

// Tombol jeda disembunyikan setelah soal selesai
$("btn-jeda").hidden = hasil;

// Mengubah tulisan tombol jeda
$("btn-jeda").textContent =
  ruang.dijeda
    ? "▶ Lanjutkan"
    : "⏸ Jeda";

// Tombol akhiri soal disembunyikan setelah soal selesai
$("btn-akhiri-soal").hidden = hasil;

// Tombol lanjut hanya muncul setelah soal selesai
$("btn-lanjut").hidden = !hasil;

// Mengubah tulisan tombol lanjut
$("btn-lanjut").textContent =
  s.index + 1 < s.total
    ? "Soal Berikutnya ➜"
    : "Lihat Hasil Akhir 🏆";

// PAPAN PERINGKAT MINI

$("papan-mini").hidden = !hasil;

if (hasil) {
  isiPeringkat(
    $("g-skor"),
    s.pemain,
    null,
    5
  );
}

// LAPORAN HASIL KUIS

// Menampilkan laporan berdasarkan kuis yang dipilih
const bukaLaporan = (kuis) => {

  // Mengambil data hasil berdasarkan kode kuis
  const data = semuaHasil.filter(
    (h) => h.kode === kuis.kode
  );

  // Menampilkan judul kuis
  $("judul-laporan").textContent = kuis.judul;

  // RINGKASAN NILAI
  const rata = data.length
    ? Math.round(
        data.reduce(
          (t, h) => t + h.skor,
          0
        ) / data.length
      )
    : 0;

  $("ringkasan").textContent =
    `${data.length} siswa mengerjakan, rata-rata skor ${rata}.`;

  // HASIL PER SISWA

  const ol = $("tabel-siswa");

  ol.innerHTML = "";

  // Urutkan siswa berdasarkan skor tertinggi
  data
    .sort((a, b) => b.skor - a.skor)
    .forEach((h) => {

      const li = buatEl("li");

      // Nama dan avatar siswa
      li.append(
        buatEl(
          "span",
          "",
          `${h.avatar} ${h.nama}`
        )
      );

      // Skor dan persentase jawaban benar
      li.append(
        buatEl(
          "span",
          "",
          `${h.skor} poin | ${
            h.total
              ? Math.round(
                  (h.benar / h.total) * 100
                )
              : 0
          }% benar`
        )
      );

      ol.append(li);
    });


  // Jika belum ada siswa
  if (data.length === 0) {
    ol.append(
      buatEl(
        "li",
        "",
        "Belum ada siswa yang mengerjakan."
      )
    );
  }

  // STATISTIK SETIAP SOAL
  const ul = $("statistik-soal");

  ul.innerHTML = "";

  kuis.soal.forEach((s, i) => {

    // Mengambil jawaban siswa untuk soal tersebut
    const jawab = data
      .map((h) =>
        h.detail.find(
          (d) => d.id === s.id
        )
      )
      .filter(Boolean);


    // Menghitung persentase jawaban benar
    const persen = jawab.length
      ? Math.round(
          (
            jawab.filter(
              (d) => d.benar
            ).length / jawab.length
          ) * 100
        )
      : 0;


    // Membuat elemen soal
    const li = buatEl("li");

    li.append(
      buatEl(
        "span",
        "",
        `${i + 1}. ${s.pertanyaan}`
      )
    );

    // PROGRESS BAR PERSENTASE BENAR
    const bar = buatEl("div", "bar");
    const isi = buatEl("div");

    isi.style.width = `${persen}%`;

    bar.append(isi);


    // Menampilkan progress bar dan persentase
    li.append(
      bar,
      buatEl(
        "span",
        "",
        `${persen}%`
      )
    );

    ul.append(li);
  });


  // Menampilkan halaman laporan
  tampilkan("laporan");
};

// SISI USER
// PILIHAN AVATAR

// Membuat pilihan avatar menggunakan radio button
// dengan gambar emoji.
const renderAvatar = () => {
  const wadah = $("avatar-pilih");

  wadah.innerHTML = "";

  AVATAR.forEach((a, i) => {
    const label = buatEl("label");
    const radio = buatEl("input");

    radio.type = "radio";
    radio.name = "avatar";
    radio.value = a;
    radio.checked = i === 0;

    radio.setAttribute(
      "aria-label",
      `Avatar ${a}`
    );

    label.append(
      radio,
      buatEl("span", "pilih-avatar", a)
    );

    wadah.append(label);
  });
};

// USER MEMASUKKAN PIN

// User memasukkan PIN untuk mencari ruangan kuis.
$("form-kode").addEventListener("submit", (e) => {
  e.preventDefault();

  keluar();

  const pin = $("kode").value.trim();

  // Membuat identitas user
  saya = {
    pin: pin,
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`,
    tahap: "cek",
    indexTampil: -1,
    pilih: null
  };
  
  // KONEKSI ANTAR TAB

  kanal = new BroadcastChannel("kuisseru");

  kanal.onmessage = (ev) => {
    terimaSiswa(ev.data);
  };

  $("pesan-kode").textContent =
    "Mencari ruangan...";

  // Mengirim pesan melalui BroadcastChannel
  kanal.postMessage({
    pin: pin,
    tipe: "cek"
  });

  // KONEKSI ANTAR PERANGKAT MENGGUNAKAN PEERJS
  if (typeof Peer !== "undefined") {
    peer = new Peer();

    peer.on("open", () => {
      if (!saya) return;

      const c = peer.connect(
        "kuisseru-" + pin,
        {
          serialization: "json"
        }
      );

      c.on("open", () => {
        koneksi = [c];

        kirim({
          pin: pin,
          tipe: "cek"
        });
      });

      c.on("data", terimaSiswa);
    });

    peer.on("error", () => {});
  }

  // KONEKSI MENGGUNAKAN MQTT

  sambungMqtt(
    pin,
    false,
    terimaSiswa,
    (ok) => {
      if (ok && saya) {
        kirim({
          pin: pin,
          tipe: "cek"
        });
      }
    }
  );


  // TIMEOUT PENCARIAN RUANGAN

  // Jika tidak ada balasan selama 6 detik,
  // ruangan dianggap tidak ditemukan.
  timeoutCek = setTimeout(() => {
    $("pesan-kode").textContent =
      "Ruangan tidak ditemukan. Cek PIN dan pastikan guru sudah membuka ruangan.";
  }, 6000);
});


// USER MENGISI NAMA DAN AVATAR

$("form-nama").addEventListener("submit", (e) => {
  e.preventDefault();

  // Mengambil nama user
  saya.nama = $("nama").value.trim();

  // Mengambil avatar yang dipilih
  saya.avatar =
    document.querySelector(
      'input[name="avatar"]:checked'
    ).value;

  // Mengubah tahap menjadi halaman utama
  saya.tahap = "main";

  // Mengirim permintaan bergabung ke admin
  kirim({
    pin: saya.pin,
    tipe: "gabung",
    id: saya.id,
    nama: saya.nama,
    avatar: saya.avatar
  });
});


// MENERIMA KEADAAN DARI aDMIN

const terimaSiswa = (msg) => {

  // Abaikan pesan jika:
  // - user belum terdaftar
  // - PIN tidak sesuai
  // - pesan bukan berupa state
  if (
    !saya ||
    msg.pin !== saya.pin ||
    msg.tipe !== "state"
  ) {
    return;
  }

  const s = msg.s;


  // TAHAP CEK RUANGAN

  if (saya.tahap === "cek") {

    clearTimeout(timeoutCek);

    // Jika kuis sudah dimulai,
    // user tidak bisa bergabung.
    if (s.status !== "lobi") {
      $("pesan-kode").textContent =
        "Kuis sudah dimulai, tidak bisa bergabung.";

      return;
    }

    $("pesan-kode").textContent = "";

    $("judul-gabung").textContent =
      s.judul;

    renderAvatar();

    saya.tahap = "gabung";

    tampilkan("gabung");


  // TAHAP UTAMA

  } else if (saya.tahap === "main") {

    renderSiswa(s);
  }
};


// INTRO PERTANYAAN

// Menampilkan tulisan "Pertanyaan N"
// dengan hitungan mundur 3 detik.
const tampilIntro = (n) => {

  let t = 3;


  // Mengatur tampilan angka countdown
  const atur = () => {

    $("intro-angka").textContent = t;

    Efek.tik();

    $("intro-lingkar").style.setProperty(
      "--p",
      `${(t / 3) * 360}deg`
    );
  };


  $("intro-judul").textContent =
    `Pertanyaan ${n}`;

  $("intro").hidden = false;

  atur();

  clearInterval(timerIntro);


  // Countdown 3 → 2 → 1
  timerIntro = setInterval(() => {

    t--;

    if (t <= 0) {
      clearInterval(timerIntro);
      $("intro").hidden = true;

    } else {
      atur();
    }

  }, 1000);
};


// MENAMPILKAN LAYAR USER

// Menggambar layar user berdasarkan keadaan dari admin.
const renderSiswa = (s) => {

  // Mencari data user yang sedang menggunakan perangkat ini
  const aku = s.pemain.find(
    (p) => p.id === saya.id
  );

  // Jika user belum terdaftar di admin
  if (!aku) return;


  // STATUS LOBI

  if (s.status === "lobi") {
    renderLobi(s, false);
    tampilkan("lobi");

    return;
  }


  // STATUS SELESAI

  if (s.status === "selesai") {

    const rank =
      urutkan(s.pemain).findIndex(
        (p) => p.id === saya.id
      ) + 1;

    $("hasil-akhir").textContent =
      `${aku.avatar} ${aku.nama}: peringkat ${rank} dengan ${aku.skor} poin`;

    isiPodium(
      s.pemain,
      saya.id
    );

    isiPeringkat(
      $("daftar-skor"),
      s.pemain,
      saya.id,
      10,
      3
    );

    tampilkan("papan");

    return;
  }


  // STATUS SOAL / HASIL

  tampilkan("live-siswa");

  const hasil =
    s.status === "hasil";


  // MEMBUAT TOMBOL JAWABAN

  // Tombol jawaban hanya dibuat sekali
  // untuk setiap soal.
  if (saya.indexTampil !== s.index) {

    saya.indexTampil = s.index;
    saya.pilih = null;


    // Tampilkan intro hanya ketika soal sedang berjalan
    if (s.status !== "hasil") {
      tampilIntro(s.index + 1);
    }


    // Tampilkan pertanyaan
    $("teks-soal").textContent =
      s.soal.pertanyaan;


    const wadah = $("pilihan");

    wadah.innerHTML = "";


    // Membuat tombol untuk setiap pilihan
    s.soal.pilihan.forEach((teks, i) => {

      const b = buatEl(
        "button",
        "opsi-btn",
        `${SIMBOL[i]} ${teks}`
      );


      // Ketika user memilih jawaban
      b.addEventListener("click", () => {

        saya.pilih = i;


        // Kirim jawaban ke admin
        kirim({
          pin: saya.pin,
          tipe: "jawab",
          id: saya.id,
          index: s.index,
          pilihan: i
        });


        // Kunci semua tombol jawaban
        document
          .querySelectorAll("#pilihan .opsi-btn")
          .forEach((x, n) => {

            x.disabled = true;

            x.classList.toggle(
              "dipilih",
              n === i
            );
          });


        $("umpan-balik").textContent =
          "Jawaban terkirim! Menunggu teman...";
      });


      wadah.append(b);
    });
  }


  // INFORMASI USER

  $("info-nomor").textContent =
    `${aku.avatar} ${aku.nama}`;

  $("info-streak").textContent =
    `🔥 ${aku.streak}`;

  $("info-streak").classList.toggle(
    "api",
    aku.streak >= 3
  );

  $("info-skor").textContent =
    `Skor: ${aku.skor}`;


  // Progress bar waktu
  $("bar-waktu").style.width =
    `${(s.sisa / s.soal.waktu) * 100}%`;


  // PAPAN PERINGKAT

  $("papan-siswa").hidden = !hasil;

  // Streak 5 atau lebih akan mengaktifkan
  // efek musik menegangkan.
  Efek.tegang(aku.streak >= 5);


  const tombol =
    document.querySelectorAll(
      "#pilihan .opsi-btn"
    );


  //  SOAL SUDAH SELESAI

  if (hasil) {

    // Tampilkan jawaban benar
    // dan kunci semua tombol.
    tombol.forEach((b, i) => {

      b.disabled = true;

      b.classList.add(
        i === s.benar
          ? "benar"
          : "salah"
      );
    });


    // Menghitung peringkat user
    const rank =
      urutkan(s.pemain).findIndex(
        (p) => p.id === saya.id
      ) + 1;


   // EFEK SUARA

    // Efek hanya dimainkan satu kali untuk setiap soal.
    if (saya.sfxIndex !== s.index) {

      saya.sfxIndex = s.index;

      if (aku.benar) {
        Efek.benar();
        Efek.konfeti(50);
      } else {
        Efek.salah();
      }
    }


    // EFEK STREAK

    if (
      aku.benar &&
      aku.streak >= 3 &&
      saya.streakIndex !== s.index
    ) {

      saya.streakIndex = s.index;

      tampilStreak(aku.streak);
    }


    // PESAN HASIL JAWABAN

    $("umpan-balik").textContent =
      aku.benar
        ? `✅ Benar +${aku.poin} (peringkat ${rank})${
            aku.streak >= 3
              ? ` 🔥 Menyala! Sterak ${aku.streak}`
              : ""
          }`
        : `${
            aku.sudahJawab
              ? "❌ Kamu belum tepat"
              : "⏰ YAH! Waktu habis"
          } (peringkat ${rank})`;


    // PERINGKAT SEMENTARA

    // Menampilkan 5 user teratas.
    isiPeringkat(
      $("s-skor"),
      s.pemain,
      saya.id,
      5
    );


    // Jika user berada di luar 5 besar,
    // tetap tampilkan posisi user tersebut.
    if (rank > 5) {

      const li = buatEl(
        "li",
        "saya"
      );

      li.append(
        buatEl(
          "span",
          "",
          `${rank}. ${aku.avatar} ${aku.nama}`
        ),

        buatEl(
          "span",
          "",
          `${aku.skor} poin`
        )
      );

      $("s-skor").append(li);
    }


  // SOAL MASIH BERJALAN

  } else {

    // Tombol dikunci jika:
    // - user sudah menjawab
    // - admin sedang menjeda soal
    tombol.forEach((b, i) => {

      b.disabled =
        aku.sudahJawab ||
        s.dijeda;

      b.classList.toggle(
        "dipilih",
        i === saya.pilih
      );
    });


    // Pesan ketika admin menjeda soal
    if (s.dijeda) {

      $("umpan-balik").textContent =
        "⏸ Dijeda oleh admin";

    // Kosongkan pesan jika user belum menjawab
    } else if (!aku.sudahJawab) {

      $("umpan-balik").textContent = "";
    }
  }
};


// TAMPILKAN HALAMAN BERANDA

tampilkan("beranda");
