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
