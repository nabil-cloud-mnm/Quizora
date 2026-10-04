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
