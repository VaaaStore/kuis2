(() => {
  'use strict';

  const SUMBER = 'soal.json';
  const KUNCI_SIMPAN = 'kuis-pengaturan-v1';
  const HURUF = 'abcdefghij';

  const app = document.getElementById('app');
  const data = { judul: 'Latihan Soal', soal: [], dilewati: [] };
  let pengaturan = { jumlah: 'semua', langsung: true };
  let sesi = null;

  /* ---------- util DOM ---------- */
  function buat(tag, atribut, ...isi) {
    const e = document.createElement(tag);
    if (atribut) {
      for (const [k, v] of Object.entries(atribut)) {
        if (v === false || v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'teks') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of isi.flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  // `kode`, **tebal**, *miring* -> node DOM (tanpa innerHTML)
  const POLA_INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
  function teksKaya(teks) {
    const t = String(teks);
    const frag = document.createDocumentFragment();
    let akhir = 0;
    for (const m of t.matchAll(POLA_INLINE)) {
      if (m.index > akhir) frag.append(t.slice(akhir, m.index));
      if (m[1] !== undefined) frag.append(buat('code', { teks: m[1] }));
      else if (m[2] !== undefined) frag.append(buat('strong', { teks: m[2] }));
      else frag.append(buat('em', { teks: m[3] }));
      akhir = m.index + m[0].length;
    }
    if (akhir < t.length) frag.append(t.slice(akhir));
    return frag;
  }

  function acak(daftar) {
    const a = daftar.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function tampilkan(...node) {
    app.replaceChildren(...node);
    window.scrollTo(0, 0);
  }

  /* ---------- pengaturan tersimpan ---------- */
  function bacaPengaturan() {
    try {
      const mentah = JSON.parse(localStorage.getItem(KUNCI_SIMPAN) || 'null');
      if (mentah && typeof mentah === 'object') {
        pengaturan = {
          jumlah: mentah.jumlah === 'semua' || Number.isInteger(mentah.jumlah) ? mentah.jumlah : 'semua',
          langsung: mentah.langsung !== false,
        };
      }
    } catch (e) { /* abaikan: penyimpanan tidak tersedia */ }
  }
  function simpanPengaturan() {
    try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(pengaturan)); } catch (e) { /* abaikan */ }
  }

  /* ---------- memuat dan memeriksa soal.json ---------- */
  // Opsi yang merujuk opsi lain ("Pilihan a dan b benar", "Semua benar") tidak boleh diacak.
  const MERUJUK_OPSI = /\b(pilihan|opsi|jawaban)\s+[a-j]\b|\b[a-j]\s+(dan|&|atau)\s+[a-j]\s+(benar|salah)\b|\b(semua|seluruh)\s+(jawaban|pilihan|opsi)?\s*(di atas\s+)?(benar|salah)\b|\b(benar|salah)\s+semua\b|\btidak ada (jawaban|pilihan|opsi)\b|\bkecuali\s+[a-j]\b/i;

  function indeksJawaban(j, jumlahOpsi) {
    if (typeof j === 'number' && Number.isInteger(j)) return j >= 0 && j < jumlahOpsi ? j : -1;
    if (typeof j === 'string' && /^[a-j]$/i.test(j.trim())) {
      const i = HURUF.indexOf(j.trim().toLowerCase());
      return i < jumlahOpsi ? i : -1;
    }
    return -1;
  }

  function masalahSoal(s) {
    if (!s || typeof s !== 'object') return 'bukan objek soal';
    if (typeof s.pertanyaan !== 'string' || !s.pertanyaan.trim()) return 'properti "pertanyaan" kosong atau bukan teks';
    if (!Array.isArray(s.opsi) || s.opsi.length < 2 || s.opsi.length > HURUF.length) return 'properti "opsi" harus berupa daftar 2 sampai 10 teks';
    if (s.opsi.some(o => typeof o !== 'string' || !o.trim())) return 'ada opsi yang kosong atau bukan teks';
    if (indeksJawaban(s.jawaban, s.opsi.length) < 0) return `"jawaban" (${JSON.stringify(s.jawaban)}) tidak cocok dengan opsi yang ada`;
    return '';
  }

  function normalisasi(mentah) {
    const daftar = Array.isArray(mentah) ? mentah : mentah && mentah.soal;
    if (!Array.isArray(daftar)) {
      throw new Error('Isi soal.json harus berupa daftar soal, atau objek dengan properti "soal" berisi daftar soal.');
    }
    const soal = [];
    const dilewati = [];
    daftar.forEach((s, n) => {
      const nama = s && s.id != null ? `id ${s.id}` : `urutan ke-${n + 1}`;
      const masalah = masalahSoal(s);
      if (masalah) { dilewati.push(`Soal ${nama}: ${masalah}.`); return; }
      soal.push({
        id: s.id != null ? s.id : n + 1,
        materi: typeof s.materi === 'string' ? s.materi.trim() : '',
        pertanyaan: s.pertanyaan.trim(),
        kode: typeof s.kode === 'string' ? s.kode.replace(/\s+$/, '') : '',
        lanjutan: typeof s.lanjutan === 'string' ? s.lanjutan.trim() : '',
        opsi: s.opsi.map(o => o.trim()),
        jawaban: indeksJawaban(s.jawaban, s.opsi.length),
        penjelasan: typeof s.penjelasan === 'string' ? s.penjelasan.trim() : '',
        acak: s.acakOpsi !== false && !s.opsi.some(o => MERUJUK_OPSI.test(o)),
      });
    });
    const judul = !Array.isArray(mentah) && typeof mentah.judul === 'string' && mentah.judul.trim()
      ? mentah.judul.trim() : 'Latihan Soal';
    return { judul, soal, dilewati };
  }

  async function muat() {
    let mentah;
    try {
      const res = await fetch(`${SUMBER}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Server membalas ${res.status} saat mengambil ${SUMBER}.`);
      const teks = await res.text();
      try { mentah = JSON.parse(teks); }
      catch (e) {
        return tampilkanGalat('Format soal.json salah',
          'File soal.json ada, tetapi bukan JSON yang valid. Periksa tanda koma, kurung, dan tanda kutip di sekitar bagian yang disebut di bawah.',
          e.message);
      }
    } catch (e) {
      if (location.protocol === 'file:') {
        return tampilkanGalat('Halaman perlu dibuka lewat server',
          'Browser memblokir pembacaan soal.json dari file lokal. Jalankan server sederhana di folder ini, lalu buka alamatnya: python -m http.server, kemudian http://localhost:8000. Di GitHub Pages masalah ini tidak muncul.');
      }
      return tampilkanGalat('Soal tidak bisa dimuat',
        `Pastikan file ${SUMBER} ada di folder yang sama dengan index.html dan namanya persis sama, huruf kecil semua.`,
        e.message);
    }

    try {
      Object.assign(data, normalisasi(mentah));
    } catch (e) {
      return tampilkanGalat('Isi soal.json tidak sesuai', 'Struktur file perlu diperbaiki.', e.message);
    }
    document.title = data.judul;
    bacaPengaturan();
    tampilkanAwal();
  }

  function tampilkanGalat(judul, penjelasan, rincian) {
    tampilkan(buat('section', { class: 'galat' },
      buat('h1', { teks: judul }),
      buat('p', { teks: penjelasan }),
      rincian ? buat('pre', null, buat('code', { teks: rincian })) : null,
      buat('div', { class: 'aksi' }, buat('button', { type: 'button', class: 'tombol', onclick: () => location.reload(), teks: 'Muat ulang' }))
    ));
  }

  /* ---------- layar awal ---------- */
  function tampilkanAwal() {
    const total = data.soal.length;
    const blokPeringatan = data.dilewati.length
      ? buat('details', { class: 'peringatan' },
          buat('summary', { teks: `${data.dilewati.length} soal dilewati karena formatnya salah` }),
          buat('ul', null, data.dilewati.map(t => buat('li', { teks: t }))))
      : null;

    if (total === 0) {
      return tampilkan(buat('section', { class: 'galat' },
        buat('h1', { teks: data.judul }),
        buat('p', { teks: 'Belum ada soal yang bisa dipakai. Isi soal.json dengan minimal satu soal yang formatnya benar.' }),
        blokPeringatan));
    }

    const pilihanJumlah = [10, 20, 30, 50].filter(n => n < total).map(String).concat('semua');
    let terpilih = String(pengaturan.jumlah);
    if (!pilihanJumlah.includes(terpilih)) terpilih = 'semua';

    const radio = pilihanJumlah.map(n => buat('label', null,
      buat('input', { type: 'radio', name: 'jumlah', value: n, checked: n === terpilih }),
      buat('span', { teks: n === 'semua' ? `Semua (${total})` : n })));

    const centang = buat('input', { type: 'checkbox', id: 'langsung', checked: pengaturan.langsung });

    const mulaiKuis = () => {
      const dipilih = app.querySelector('input[name="jumlah"]:checked');
      pengaturan = {
        jumlah: !dipilih || dipilih.value === 'semua' ? 'semua' : Number(dipilih.value),
        langsung: centang.checked,
      };
      simpanPengaturan();
      susunSesi(data.soal, pengaturan.jumlah);
    };

    tampilkan(
      buat('header', null,
        buat('h1', { class: 'judul-besar', teks: data.judul }),
        buat('p', { class: 'pengantar', teks: `Bank soal berisi ${total} soal. Jawab, lihat skor dan rincian per materi, lalu ulangi dengan urutan yang diacak.` })),
      buat('section', { class: 'mulai', 'aria-labelledby': 'tanya-mulai' },
        buat('h2', { id: 'tanya-mulai', teks: 'Mau mulai kuis?' }),
        buat('fieldset', null, buat('legend', { teks: 'Jumlah soal' }), buat('div', { class: 'segmen' }, radio)),
        buat('label', { class: 'centang', for: 'langsung' }, centang,
          buat('span', { teks: 'Tampilkan jawaban yang benar setelah tiap soal' })),
        buat('div', { class: 'aksi' },
          buat('button', { type: 'button', class: 'tombol', onclick: mulaiKuis, teks: 'Mulai kuis' }))),
      blokPeringatan
    );
  }

  /* ---------- sesi kuis ---------- */
  function susunSesi(sumber, jumlah) {
    const n = jumlah === 'semua' ? sumber.length : Math.min(Number(jumlah), sumber.length);
    const soal = acak(sumber).slice(0, n).map(s => {
      const urutan = s.opsi.map((_, i) => i);
      const tampil = (s.acak ? acak(urutan) : urutan).map(i => ({ teks: s.opsi[i], benar: i === s.jawaban }));
      return { ...s, tampil };
    });
    sesi = { soal, posisi: 0, pilihan: new Array(soal.length).fill(null), terkunci: false, sumber, jumlah };
    tampilkanSoal();
  }

  function tampilkanSoal() {
    const { soal, posisi } = sesi;
    const s = soal[posisi];
    sesi.terkunci = false;

    const judulSoal = buat('h2', { class: 'pertanyaan', tabindex: '-1', id: 'pertanyaan' }, teksKaya(s.pertanyaan));
    const tombol = s.tampil.map((o, i) => buat('button', {
      type: 'button', class: 'pilihan', 'aria-pressed': 'false', onclick: () => pilih(i),
    },
      buat('span', { class: 'huruf', teks: HURUF[i] }),
      buat('span', { class: 'isi' }, teksKaya(o.teks)),
      buat('span', { class: 'tanda', 'aria-hidden': 'true' })));

    const umpan = buat('div', { class: 'umpan', 'aria-live': 'polite' });
    const terakhir = posisi === soal.length - 1;
    const lanjut = buat('button', { type: 'button', class: 'tombol', disabled: true, onclick: lanjutkan, teks: terakhir ? 'Lihat hasil' : 'Lanjut' });

    function segarkan() {
      const dipilih = sesi.pilihan[posisi];
      tombol.forEach((t, i) => {
        const o = s.tampil[i];
        const tanda = t.querySelector('.tanda');
        t.classList.remove('dipilih', 'benar', 'salah', 'redup');
        tanda.textContent = '';
        t.setAttribute('aria-pressed', String(dipilih === i));
        t.setAttribute('aria-disabled', String(sesi.terkunci));
        if (sesi.terkunci) {
          if (o.benar) { t.classList.add('benar'); tanda.textContent = '✓'; }
          else if (dipilih === i) { t.classList.add('salah'); tanda.textContent = '✗'; }
          else t.classList.add('redup');
        } else if (dipilih === i) {
          t.classList.add('dipilih');
        }
      });
      lanjut.disabled = dipilih === null;
      umpan.replaceChildren();
      if (sesi.terkunci) {
        const benar = s.tampil[dipilih].benar;
        const hurufBenar = HURUF[s.tampil.findIndex(o => o.benar)];
        umpan.append(benar
          ? buat('strong', { class: 'benar', teks: 'Benar.' })
          : buat('strong', { class: 'salah', teks: `Salah. Jawaban yang benar: ${hurufBenar}.` }));
        if (s.penjelasan) umpan.append(buat('p', null, teksKaya(s.penjelasan)));
      }
    }

    function pilih(i) {
      if (sesi.terkunci) return;
      sesi.pilihan[posisi] = i;
      if (pengaturan.langsung) sesi.terkunci = true;
      segarkan();
      if (sesi.terkunci) lanjut.focus();
    }

    function lanjutkan() {
      if (sesi.pilihan[posisi] === null) return;
      if (posisi + 1 < soal.length) { sesi.posisi++; tampilkanSoal(); }
      else tampilkanHasil();
    }

    sesi.aksi = { pilih, lanjutkan, jumlahOpsi: tombol.length };

    const persen = (posisi / soal.length) * 100;
    tampilkan(
      buat('div', { class: 'kepala-soal' },
        buat('span', { class: 'posisi', teks: `Soal ${posisi + 1} dari ${soal.length}` }),
        buat('button', { type: 'button', class: 'tautan', onclick: berhenti, teks: 'Berhenti' }),
        buat('div', { class: 'progres', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(soal.length), 'aria-valuenow': String(posisi) },
          buat('div', { style: `--lebar:${persen}%` }))),
      judulSoal,
      s.kode ? buat('pre', null, buat('code', { teks: s.kode })) : null,
      s.lanjutan ? buat('p', { class: 'lanjutan' }, teksKaya(s.lanjutan)) : null,
      buat('div', { class: 'opsi', role: 'group', 'aria-labelledby': 'pertanyaan' }, tombol),
      umpan,
      buat('div', { class: 'kaki-soal' }, lanjut)
    );
    judulSoal.focus({ preventScroll: true });
  }

  function berhenti() {
    if (window.confirm('Berhenti sekarang? Jawaban yang sudah diisi tidak disimpan.')) {
      sesi = null;
      tampilkanAwal();
    }
  }

  document.addEventListener('keydown', ev => {
    if (!sesi || !sesi.aksi || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (!document.getElementById('pertanyaan')) return;
    const aktif = document.activeElement;
    const bebas = aktif === document.body || (aktif && aktif.id === 'pertanyaan');
    const idx = HURUF.indexOf(ev.key.toLowerCase());
    if (ev.key.length === 1 && idx >= 0 && idx < sesi.aksi.jumlahOpsi) {
      ev.preventDefault();
      sesi.aksi.pilih(idx);
    } else if (ev.key === 'Enter' && bebas) {
      ev.preventDefault();
      sesi.aksi.lanjutkan();
    }
  });

  /* ---------- layar hasil ---------- */
  const LINGKARAN = '<svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
    + '<path pathLength="1" d="M26 66 C 14 34, 78 8, 158 8 C 242 8, 294 34, 284 68 C 274 102, 190 114, 112 110 C 50 106, 10 90, 14 60 C 16 44, 34 30, 60 22"/></svg>';

  function ringkasanNilai(persen) {
    if (persen >= 85) return ['Materi sudah kuat.', 'Ulangi sesekali dengan urutan acak supaya tetap ingat.'];
    if (persen >= 70) return ['Sudah cukup baik.', 'Perkuat materi yang skornya paling rendah di bawah ini.'];
    if (persen >= 50) return ['Masih banyak yang perlu diulang.', 'Mulai dari materi dengan skor terendah, lalu ulangi soal yang salah.'];
    return ['Perlu belajar ulang.', 'Baca kembali ringkasan materi, lalu coba lagi dengan soal yang salah.'];
  }

  function tampilkanHasil() {
    sesi.aksi = null;
    const hasil = sesi.soal.map((s, i) => ({ s, i, benar: s.tampil[sesi.pilihan[i]].benar, dipilih: sesi.pilihan[i] }));
    const total = hasil.length;
    const benar = hasil.filter(h => h.benar).length;
    const salah = hasil.filter(h => !h.benar);
    const persen = Math.round((benar / total) * 100);
    const [kalimat, saran] = ringkasanNilai(persen);

    const nilai = buat('div', { class: 'nilai', role: 'img', 'aria-label': `${benar} dari ${total} soal benar` },
      buat('span', { class: 'angka', teks: String(benar) }),
      buat('span', { class: 'dari', teks: `dari ${total}` }));
    nilai.insertAdjacentHTML('beforeend', LINGKARAN);

    // rincian per materi
    const kelompok = new Map();
    hasil.forEach(h => {
      const nama = h.s.materi || 'Tanpa materi';
      const k = kelompok.get(nama) || { nama, benar: 0, total: 0 };
      k.total++; if (h.benar) k.benar++;
      kelompok.set(nama, k);
    });
    const daftarMateri = [...kelompok.values()].sort((a, b) => a.benar / a.total - b.benar / b.total);
    const blokMateri = daftarMateri.length > 1 || (daftarMateri[0] && daftarMateri[0].nama !== 'Tanpa materi')
      ? buat('section', { class: 'bagian' },
          buat('h2', { teks: 'Skor per materi' }),
          buat('ul', { class: 'per-materi' }, daftarMateri.map(k => {
            const p = Math.round((k.benar / k.total) * 100);
            return buat('li', { class: p < 60 ? 'rendah' : '' },
              buat('span', { teks: k.nama }),
              buat('span', { class: 'skor', teks: `${k.benar}/${k.total}` }),
              buat('div', { class: 'batang', 'aria-hidden': 'true' }, buat('div', { style: `--lebar:${p}%` })));
          })))
      : null;

    // tinjauan jawaban salah
    const blokSalah = salah.length
      ? buat('section', { class: 'bagian' },
          buat('h2', { teks: `Soal yang salah (${salah.length})` }),
          buat('ol', { class: 'tinjau', style: 'padding:0' }, salah.map(h => {
            const o = h.s.tampil;
            return buat('li', null,
              buat('p', { class: 'no', teks: `Soal ke-${h.i + 1} dalam sesi ini${h.s.materi ? `, ${h.s.materi}` : ''}` }),
              buat('p', { class: 'tanya' }, teksKaya(h.s.pertanyaan)),
              h.s.kode ? buat('pre', null, buat('code', { teks: h.s.kode })) : null,
              h.s.lanjutan ? buat('p', { class: 'lanjut' }, teksKaya(h.s.lanjutan)) : null,
              buat('p', { class: 'jawab anda' }, buat('b', { teks: 'Jawaban Anda' }), teksKaya(o[h.dipilih].teks)),
              buat('p', { class: 'jawab kunci' }, buat('b', { teks: 'Jawaban yang benar' }), teksKaya(o.find(x => x.benar).teks)),
              h.s.penjelasan ? buat('p', { class: 'catatan' }, teksKaya(h.s.penjelasan)) : null);
          })))
      : buat('p', { class: 'saran', teks: 'Tidak ada soal yang salah di sesi ini.' });

    tampilkan(
      buat('h1', { class: 'sr-judul', style: 'position:absolute;left:-9999px', teks: 'Hasil kuis' }),
      nilai,
      buat('p', { class: 'ringkas', teks: `${benar} dari ${total} soal benar (${persen}%). ${kalimat}` }),
      buat('p', { class: 'saran', teks: saran }),
      buat('div', { class: 'aksi' },
        buat('button', { type: 'button', class: 'tombol', onclick: () => susunSesi(sesi.sumber, sesi.jumlah), teks: 'Ulangi kuis' }),
        salah.length ? buat('button', { type: 'button', class: 'tombol sekunder', onclick: () => susunSesi(salah.map(h => h.s), 'semua'), teks: 'Ulangi soal yang salah' }) : null,
        buat('button', { type: 'button', class: 'tautan', onclick: () => { sesi = null; tampilkanAwal(); }, teks: 'Ubah pengaturan' })),
      blokMateri,
      blokSalah
    );
  }

  muat();
})();
