// EFEK QUIZORA
// 1. Musik latar
// 2. Efek suara
// 3. Konfeti
// 4. Hiasan bergerak
// 5. Tombol suara
// 6. Mode tegang
// Semua suara dibuat langsung menggunakan WebAudio,

const Efek = (() => {

  // VARIABEL AUDIO

  let ctx = null;
  let master = null;
  let timer = null;

  let mode = null;
  let langkah = 0;
  let tNext = 0;

  let terakhirLayar = null;

  let bisu = false;
  let tegangAktif = false;


  // Mengambil pengaturan suara dari localStorage
  try {
    bisu =
      localStorage.getItem("quizora_bisu") === "1";
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }


  // MEMBUAT AUDIO CONTEXT

  const ac = () => {

    if (!ctx) {

      const C =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!C) return null;

      ctx = new C();

      master = ctx.createGain();

      master.gain.value =
        bisu ? 0 : 0.5;

      master.connect(ctx.destination);
    }


    // kalau audio sedang ditangguhkan,
    // aktifkan kembali.
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    return ctx;
  };


  // KONVERSI MIDI KE FREKUENSI

  const mtof = (n) => {
    return 440 * Math.pow(
      2,
      (n - 69) / 12
    );
  };


  // MEMBUAT NADA

  const nada = (
    f,
    t,
    d,
    tipe = "triangle",
    v = 0.2
  ) => {

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = tipe;
    o.frequency.value = f;

    g.gain.setValueAtTime(
      0.0001,
      t
    );

    g.gain.linearRampToValueAtTime(
      v,
      t + 0.01
    );

    g.gain.exponentialRampToValueAtTime(
      0.0001,
      t + d
    );

    o.connect(g);
    g.connect(master);

    o.start(t);
    o.stop(t + d + 0.05);
  };


  // MEMBUAT SUARA KICK

  const kick = (t) => {

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.frequency.setValueAtTime(
      150,
      t
    );

    o.frequency.exponentialRampToValueAtTime(
      40,
      t + 0.15
    );

    g.gain.setValueAtTime(
      0.5,
      t
    );

    g.gain.exponentialRampToValueAtTime(
      0.001,
      t + 0.18
    );

    o.connect(g);
    g.connect(master);

    o.start(t);
    o.stop(t + 0.2);
  };


  // MEMBUAT SUARA HI-HAT

  let derau = null;

  const hat = (t) => {

    // Membuat sumber noise hanya sekali
    if (!derau) {

      derau = ctx.createBuffer(
        1,
        ctx.sampleRate * 0.05,
        ctx.sampleRate
      );

      const d =
        derau.getChannelData(0);

      for (let i = 0; i < d.length; i++) {
        d[i] = Math.random() * 2 - 1;
      }
    }


    const s =
      ctx.createBufferSource();

    const f =
      ctx.createBiquadFilter();

    const g =
      ctx.createGain();


    s.buffer = derau;

    f.type = "highpass";
    f.frequency.value = 7000;

    g.gain.setValueAtTime(
      0.07,
      t
    );

    g.gain.exponentialRampToValueAtTime(
      0.001,
      t + 0.04
    );


    s.connect(f);
    f.connect(g);
    g.connect(master);

    s.start(t);
  };


  // POLA MUSIK LATAR

  // Akor musik
  const AKOR = [
    [76, 79, 84],
    [74, 77, 81],
    [72, 76, 79],
    [71, 74, 79],
    [79, 84, 88],
    [77, 81, 84],
    [76, 79, 84],
    [74, 79, 83]
  ];


  // Nada dasar
  const AKAR = [
    48,
    50,
    48,
    43
  ];


  // Pengaturan musik berdasarkan mode
  const POLA = {
    lobi: {
      bpm: 118,
      tipe: "triangle",
      v: 0.16,
      geser: 0
    },

    kuis: {
      bpm: 150,
      tipe: "square",
      v: 0.06,
      geser: 2
    },

    tegang: {
      bpm: 150
    }
  };


  // MUSIK MODE TEGANG

  // detak jantung + bass + nada tinggi.
  const detak = (t, v) => {

    const o =
      ctx.createOscillator();

    const g =
      ctx.createGain();


    o.frequency.setValueAtTime(
      95,
      t
    );

    o.frequency.exponentialRampToValueAtTime(
      40,
      t + 0.12
    );


    g.gain.setValueAtTime(
      v,
      t
    );

    g.gain.exponentialRampToValueAtTime(
      0.001,
      t + 0.2
    );


    o.connect(g);
    g.connect(master);

    o.start(t);
    o.stop(t + 0.25);
  };


  const jadwalTegang = (dur) => {

    while (
      tNext <
      ctx.currentTime + 0.6
    ) {

      const s = langkah % 4;

      const bar =
        Math.floor(langkah / 16) % 4;


      // Detak jantung
      if (s === 0) {
        detak(tNext, 0.9);
      }

      if (s === 1) {
        detak(tNext, 0.55);
      }


      // Bass
      nada(
        mtof(
          [45, 45, 43, 44][bar]
        ),
        tNext,
        dur * 0.9,
        "sawtooth",
        0.06
      );


      // Nada tinggi
      nada(
        mtof(
          81 +
          (langkah % 2) +
          bar
        ),
        tNext,
        dur * 0.8,
        "square",
        0.03
      );


      // Hi-hat
      if (langkah % 2 === 1) {
        hat(tNext);
      }


      langkah++;
      tNext += dur;
    }
  };


  // MENJADWALKAN MUSIK

  const jadwal = () => {

    const p = POLA[mode];

    if (!p) return;


    const dur =
      60 / p.bpm / 2;


    // Jika mode tegang,
    // gunakan pola musik tegang.
    if (mode === "tegang") {
      jadwalTegang(dur);
      return;
    }


    // Musik lobi dan kuis
    while (
      tNext <
      ctx.currentTime + 0.6
    ) {

      const bar =
        Math.floor(langkah / 8) % 8;

      const s =
        langkah % 8;


      // Melodi utama
      const nadaLead = [
        0,
        1,
        2,
        1,
        0,
        1,
        2,
        null
      ][s];


      if (nadaLead !== null) {

        nada(
          mtof(
            AKOR[bar][nadaLead] +
            p.geser
          ),
          tNext,
          dur * 1.4,
          p.tipe,
          p.v
        );
      }


      // Nada dasar
      const akar =
        AKAR[bar % 4] +
        p.geser;


      if (s === 0 || s === 4) {

        nada(
          mtof(akar),
          tNext,
          dur * 2,
          "sine",
          0.22
        );
      }


      // Nada tambahan
      if (s === 2 || s === 6) {

        nada(
          mtof(akar + 7),
          tNext,
          dur,
          "sine",
          0.1
        );
      }


      // Suara kick
      if (
        s === 0 ||
        s === 4 ||
        (
          mode === "kuis" &&
          (s === 2 || s === 6)
        )
      ) {
        kick(tNext);
      }


      // Hi-hat
      if (s % 2 === 1) {
        hat(tNext);
      }


      langkah++;
      tNext += dur;
    }
  };


  // MULAI MUSIK

  const mulaiMusik = (m) => {

    // Jika mode masih sama,
    // tidak perlu membuat musik baru.
    if (mode === m) return;

    hentikanMusik();

    if (!ac()) return;

    mode = m;

    langkah = 0;

    tNext =
      ctx.currentTime + 0.05;

    timer =
      setInterval(jadwal, 100);
  };


  // HENTIKAN MUSIK

  const hentikanMusik = () => {

    clearInterval(timer);

    timer = null;
    mode = null;
  };


  // EFEK SUARA

  const arp = (
    notes,
    jarak,
    tipe,
    v,
    d = 0.25
  ) => {

    if (!ac()) return;

    const t =
      ctx.currentTime;

    notes.forEach((n, i) => {

      nada(
        mtof(n),
        t + i * jarak,
        d,
        tipe,
        v
      );
    });
  };


  // Suara jawaban benar
  const benar = () => {
    arp(
      [72, 76, 79, 84],
      0.08,
      "triangle",
      0.25
    );
  };


  // Suara jawaban salah
  const salah = () => {

    if (!ac()) return;

    const t =
      ctx.currentTime;

    nada(
      196,
      t,
      0.25,
      "sawtooth",
      0.12
    );

    nada(
      147,
      t + 0.2,
      0.45,
      "sawtooth",
      0.12
    );
  };


  // Suara streak
  const streak = () => {

    arp(
      [72, 76, 79, 84, 88, 91, 96],
      0.07,
      "square",
      0.1,
      0.3
    );
  };


  // Suara countdown
  const tik = () => {

    if (ac()) {
      nada(
        880,
        ctx.currentTime,
        0.1,
        "sine",
        0.2
      );
    }
  };


  // Suara klik tombol
  const klik = () => {

    if (ac()) {
      nada(
        660,
        ctx.currentTime,
        0.06,
        "sine",
        0.1
      );
    }
  };


  // Suara bel
  const bel = () => {

    arp(
      [84, 88],
      0.12,
      "sine",
      0.2,
      0.5
    );
  };


  // Suara kemenangan
  const fanfare = () => {

    arp(
      [72, 76, 79, 84, 79, 84, 88, 91],
      0.14,
      "triangle",
      0.22,
      0.7
    );
  };


  // KONFETI

  let kanvas = null;
  let k2 = null;
  let partikel = [];
  let jalan = false;


  const WARNA = [
    "#e21b3c",
    "#3b6bd0",
    "#ffc107",
    "#26c281",
    "#ff7ab8",
    "#ffffff"
  ];


  // Menggambar partikel konfeti
  const gambar = () => {

    k2.clearRect(
      0,
      0,
      kanvas.width,
      kanvas.height
    );


    partikel.forEach((p) => {

      // Gerakan partikel
      p.vy += 0.12;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;


      // Menggambar partikel
      k2.save();

      k2.translate(
        p.x,
        p.y
      );

      k2.rotate(p.r);

      k2.fillStyle = p.w;

      k2.fillRect(
        -p.u / 2,
        -p.u / 4,
        p.u,
        p.u / 2
      );

      k2.restore();
    });


    // Hapus partikel yang sudah keluar layar
    partikel =
      partikel.filter(
        (p) =>
          p.y <
          kanvas.height + 30
      );


    // kalau masih ada partikel,
    // lanjutkan animasi.
    if (partikel.length) {

      requestAnimationFrame(gambar);

    } else {

      jalan = false;

      k2.clearRect(
        0,
        0,
        kanvas.width,
        kanvas.height
      );
    }
  };


  // Membuat konfeti
  const konfeti = (
    n = 80,
    gaya = "atas"
  ) => {

    // Tidak menjalankan animasi jika
    // pengguna memilih reduced motion.
    if (
      window.matchMedia &&
      matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      return;
    }


    // Membuat canvas jika belum ada
    if (!kanvas) {

      kanvas =
        document.createElement("canvas");

      kanvas.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:30";

      document.body.append(kanvas);

      k2 =
        kanvas.getContext("2d");
    }


    kanvas.width = innerWidth;
    kanvas.height = innerHeight;


    // Membuat partikel
    for (let i = 0; i < n; i++) {

      const ledak =
        gaya === "ledak";


      partikel.push({
        x: ledak
          ? kanvas.width / 2
          : Math.random() * kanvas.width,

        y: ledak
          ? kanvas.height * 0.6
          : -10,

        vx: (Math.random() - 0.5) *
          (ledak ? 14 : 4),

        vy: ledak
          ? -8 - Math.random() * 9
          : Math.random() * 3,

        r: Math.random() * 6,

        vr: (Math.random() - 0.5) *
          0.3,

        u: 8 + Math.random() * 8,

        w: WARNA[
          i % WARNA.length
        ]
      });
    }


    // Jalankan animasi
    if (!jalan) {

      jalan = true;

      requestAnimationFrame(gambar);
    }
  };


  // HIASAN MELAYANG DI LATAR

  const hiasan = () => {

    const w =
      document.createElement("div");

    w.id = "hiasan";

    w.setAttribute(
      "aria-hidden",
      "true"
    );


    const sim = [
      "▲",
      "◆",
      "●",
      "■"
    ];

    const war = [
      "#e21b3c",
      "#3b6bd0",
      "#d89e00",
      "#26890c"
    ];


    // Membuat 14 hiasan
    for (let i = 0; i < 14; i++) {

      const s =
        document.createElement("span");

      s.textContent =
        sim[i % 4];

      s.style.color =
        war[i % 4];

      s.style.left =
        `${(
          i * 7.3 +
          Math.random() * 6
        ) % 100}%`;

      s.style.fontSize =
        `${20 + Math.random() * 38}px`;

      s.style.animationDuration =
        `${12 + Math.random() * 12}s`;

      s.style.animationDelay =
        `${-Math.random() * 20}s`;

      w.append(s);
    }


    document.body.prepend(w);
  };


  // TOMBOL SUARA DAN PENGAIT

  const pasang = () => {

    // Membuat hiasan
    hiasan();


    // Membuat tombol suara
    const b =
      document.createElement("button");

    b.id = "btn-suara";

    b.type = "button";

    b.setAttribute(
      "aria-label",
      "Nyalakan/matikan suara"
    );


    // Mengubah ikon tombol suara
    const tampil = () => {

      b.textContent =
        bisu ? "🔇" : "🔊";
    };


    tampil();


    // Ketika tombol suara ditekan
    b.addEventListener(
      "click",
      (e) => {

        e.stopPropagation();

        bisu = !bisu;

        ac();


        if (master) {

          master.gain.value =
            bisu ? 0 : 0.5;
        }


        try {

          localStorage.setItem(
            "quizora_bisu",
            bisu ? "1" : "0"
          );

        } catch {
          // Abaikan jika localStorage tidak tersedia
        }


        tampil();
      }
    );


    document.body.append(b);


    // Browser membutuhkan interaksi pertama
    // sebelum audio dapat dimainkan.
    document.addEventListener(
      "pointerdown",
      () => ac(),
      {
        once: true
      }
    );


    // Efek klik untuk tombol tertentu
    document.addEventListener(
      "click",
      (e) => {

        if (
          e.target.closest(
            ".btn, .opsi-btn, .nav-btn, .link-btn, .avatar-grid label"
          )
        ) {
          klik();
        }
      }
    );
  };


  // Menjalankan pemasangan ketika halaman siap
  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      pasang
    );

  } else {

    pasang();
  }


  // MODE TEGANG

  // Mengaktifkan atau menonaktifkan mode deg-degan.
  // Mode ini digunakan ketika streak siswa mencapai 5.
  const atur = (b) => {

    // Jika kondisi tidak berubah,
    // tidak perlu melakukan apa-apa.
    if (tegangAktif === b) return;

    tegangAktif = b;


    // Menambahkan / menghapus efek tegang
    document.body.classList.toggle(
      "tegang",
      b
    );


    // kalau sedang berada di layar siswa,
    // ganti musik menjadi mode tegang.
    if (
      terakhirLayar === "live-siswa"
    ) {

      mulaiMusik(
        b ? "tegang" : "kuis"
      );
    }
  };


  // PERPINDAHAN LAYAR

  // Dipanggil setiap kali berpindah halaman.
  const layar = (id, guru) => {

    // kalau masih berada di layar yang sama,
    // tidak perlu mengubah musik.
    if (
      id === terakhirLayar
    ) {
      return;
    }


    terakhirLayar = id;


    // Selain layar user,
    // mode tegang dinonaktifkan.
    if (id !== "live-siswa") {
      atur(false);
    }


    // Musik lobi
    if (
      id === "lobi" ||
      id === "gabung"
    ) {

      mulaiMusik("lobi");


    // Musik kuis user
    } else if (
      id === "live-siswa"
    ) {

      mulaiMusik(
        tegangAktif
          ? "tegang"
          : "kuis"
      );


    // Musik kuis admin
    } else if (
      id === "live-guru"
    ) {

      mulaiMusik("kuis");


    // Layar lainnya tidak menggunakan musik
    } else {

      hentikanMusik();
    }


    // Jika masuk papan hasil,
    // tampilkan fanfare + konfeti.
    if (id === "papan") {

      fanfare();

      konfeti(
        160,
        "ledak"
      );
    }
  };


  // FUNGSI YANG DAPAT DIGUNAKAN DARI LUAR

  return {
    layar,
    benar,
    salah,
    streak,
    tik,
    bel,
    konfeti,
    tegang: atur
  };

})();