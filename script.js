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

