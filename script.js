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
  if (!sebagaiGuru) { setKarakter($("lobi-avatar"), saya.avatar); $("lobi-nama").textContent = saya.nama; }
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
  do { kode = Math.random().toString(36).slice(2, 8).toUpperCase(); }
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
  if (kuisEdit && kuisEdit.kode === kode) { kuisEdit = null; $("editor").hidden = true; }
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

// Jalur relay: terhubung ke broker MQTT publik lewat WebSocket.
// Admin mendengar topik "user", user mendengar topik "state".
const sambungMqtt = (pin, sebagaiGuru, onData, onStatus) => {
  if (typeof mqtt === "undefined") { onStatus(false); return; }
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

// Kirim keadaan ke semua user, lalu perbarui layar admin
const siarkan = () => {
  kirim({ pin: ruang.pin, tipe: "state", s: keadaan() });
  renderGuru();
};




