# PRD &amp; Technical Specification

# ACSL Virtual FPGA Lab

**Project Type:** Web-based FPGA Lab Simulator dengan Vivado-style Design Flow dan Virtual Nexys A7 **Project Status:** Initial Development **Version:** 1.1.0 **Reference Project:** [HDLBoard](https://github.com/rlangoy/HDLBoard) (kandidat fondasi, lihat 2.2) **Documentation Reference:** [fpga.acsl.my.id](http://fpga.acsl.my.id) **Target Hardware:** Digilent Nexys A7 **Primary Language:** VHDL, Verilog **Simulation Engines:** GHDL, Icarus Verilog

---

# 0. Changelog

## v1.1.0

Perubahan utama dari v1.0.0:

1. **Ditambahkan Bab 7: Vivado-style Design Flow.** Alur Synthesis, I/O Planning, Implementation, Generate Bitstream, Hardware Manager, hingga Program Device, lengkap dengan aturan dependensi dan dialog peringatan.
2. **Ditambahkan Dua Mode Penggunaan** (Behavioral Simulation dan Board Flow) di 1.4.
3. **Keputusan fork vs scratch** dijadikan decision gate di Phase 0 (2.2), tidak lagi diasumsikan fork.
4. **Ditambahkan Bab 14: Akun, Project, dan Peran** (persistence, login, peran asisten/dosen).
5. **Ditambahkan Bab 15: Non-Functional Requirements.**
6. **Ditambahkan simulated time vs real time** (10.3) karena clock 100 MHz dan clock divider praktikum berpotensi membuat simulasi sangat lambat.
7. **Roadmap disusun ulang** (Phase 3 baru: Design Flow). Penomoran phase berubah dari v1.0.0.
8. Aturan agent diperbarui: langkah Vivado yang disimulasikan harus diberi label jujur, dan tidak boleh menampilkan angka laporan palsu yang menyesatkan.
9. Ditambahkan Bab 22: Open Questions.

---

# 1. Project Overview

## 1.1 Background

ACSL Virtual FPGA Lab merupakan platform simulasi praktikum FPGA berbasis web yang dikembangkan untuk mendukung kegiatan praktikum Advanced Computer System Laboratory (ACSL).

Praktikum ACSL menggunakan Digilent Nexys A7 sebagai perangkat hardware utama dan Vivado sebagai toolchain. Jumlah board fisik tidak cukup agar semua praktikan dapat mencoba secara bersamaan. Platform ini dibuat agar setiap praktikan dapat menjalankan **alur kerja yang sama seperti di Vivado**, dari menulis HDL sampai memprogram board, dengan **board virtual** sebagai pengganti board fisik pada tahap akhir.

Inspirasi pengalaman pengguna berasal dari:

- Cisco Packet Tracer: workspace interaktif dan simulasi perangkat.
- PNETLab: lingkungan simulasi berbasis perangkat dan koneksi.
- Wokwi: simulasi komponen elektronik dan microcontroller.
- HDLBoard: simulasi FPGA berbasis VHDL dan Verilog.
- Vivado: alur Synthesis, Implementation, Bitstream, dan Hardware Manager.

Platform ini tidak bertujuan menjadi simulator elektronik universal atau pengganti Vivado. Fokus utamanya adalah lingkungan praktikum virtual yang sesuai kurikulum FPGA ACSL dan melatih urutan kerja (workflow) yang benar sebelum mahasiswa memakai board asli.

## 1.2 Main Objectives

1. Menyediakan virtual FPGA yang merepresentasikan Nexys A7.
2. Menjalankan source code VHDL dan Verilog menggunakan simulator sesungguhnya.
3. Mendukung source code dari modul praktikum ACSL tanpa perubahan yang tidak diperlukan.
4. Menyediakan **Vivado-style Design Flow** agar praktikan memahami urutan kerja pada board asli.
5. Menyediakan komponen input dan output virtual.
6. Mendukung komunikasi UART dan virtual serial terminal.
7. Menyediakan visualisasi hasil simulasi secara interaktif.
8. Menjadi platform praktikum terpusat yang dapat dikembangkan untuk kebutuhan laboratorium.

## 1.3 Development Philosophy

- Reuse existing technology.
- Hardware-accurate I/O behavior.
- Simulation-first architecture.
- Modular and extensible.
- Curriculum-driven development.
- Secure execution of user-submitted HDL code.
- **Honest simulation:** bagian yang hanya simulasi tampilan (Implementation, Bitstream) harus jelas diberi label sebagai simulasi edukatif, dan bagian yang nyata (analisis HDL, pin mapping, perilaku board) harus benar-benar nyata.

**Jangan membangun ulang simulator HDL.** GHDL dan Icarus Verilog tetap menjadi engine simulasi.

## 1.4 Dua Mode Penggunaan

Seperti di Vivado, ada dua jalur kerja yang berbeda. Keduanya harus tersedia dan dipisahkan dengan jelas di UI.


| Mode                      | Padanan di Vivado               | Tujuan                                | Output                                              |
| ------------------------- | ------------------------------- | ------------------------------------- | --------------------------------------------------- |
| **Behavioral Simulation** | Run Simulation (testbench)      | Memverifikasi logika dengan testbench | Waveform, console log                               |
| **Board Flow**            | Synthesis sampai Program Device | Menjalankan desain di board virtual   | Virtual Nexys A7 hidup (LED, 7-segment, UART, dll.) |


Dugaan awal pemetaan kurikulum (wajib dikonfirmasi terhadap modul resmi):

- Bab 1 sampai 3 dominan memakai Behavioral Simulation.
- Bab 4 sampai 7 memakai Board Flow, dengan Behavioral Simulation tetap tersedia untuk debug.

---

# 2. Project Foundation

## 2.1 Upstream Repository (Kandidat)

Repository kandidat: [https://github.com/rlangoy/HDLBoard](https://github.com/rlangoy/HDLBoard)

HDLBoard adalah **kandidat fondasi**, bukan keputusan final. Keputusan fork atau scratch ditentukan di Phase 0 melalui decision gate (2.2).

Strategi audit:

1. Fork repository upstream (untuk keperluan audit).
2. Clone fork ke development environment.
3. Jalankan aplikasi dan pelajari struktur frontend dan backend.
4. Identifikasi pipeline GHDL dan Icarus Verilog.
5. Identifikasi sistem board configuration.
6. Identifikasi sistem input/output virtual.
7. Isi decision record (2.2).

Jangan langsung melakukan redesign keseluruhan aplikasi sebelum keputusan dibuat.

## 2.2 Decision Gate: Fork vs Scratch

**Timebox:** 2 sampai 3 hari kerja pada Phase 0.

Fitur terbesar proyek ini (Design Flow, board profile Nexys A7, sandbox multi-user, akun, UART terminal) hampir seluruhnya baru. Nilai yang mungkin diambil dari HDLBoard terbatas pada editor, waveform viewer, dan wrapper GHDL/Icarus. Karena itu keputusan harus berbasis audit, bukan asumsi.

**Pertanyaan keputusan:**


| #   | Pertanyaan                                                                                                                           | Jika jawabannya "ya" | Jika "tidak"      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ----------------- |
| 1   | Apakah simulasi berjalan di server (bukan di browser/WASM), atau mudah dipindah ke server-side sandbox?                              | Mendukung fork       | Mendukung scratch |
| 2   | Apakah pipeline GHDL/Icarus modular sehingga bisa diubah (flag `-fsynopsys`, multi-file, VHDL-2008) tanpa menulis ulang banyak kode? | Mendukung fork       | Mendukung scratch |
| 3   | Apakah kode frontend/backend cukup terbaca, terawat, dan stack-nya dikuasai tim?                                                     | Mendukung fork       | Mendukung scratch |
| 4   | Apakah editor, waveform, dan mekanisme input/output virtual bisa dipakai ulang secara bermakna?                                      | Mendukung fork       | Mendukung scratch |
| 5   | Apakah lisensi GPL-2.0 turunan dapat diterima oleh ACSL?                                                                             | Mendukung fork       | Fork tidak bisa   |


**Aturan keputusan (usulan):** jika 2 atau lebih dari pertanyaan 1 sampai 4 dijawab "tidak", atau pertanyaan 5 dijawab "tidak", pilih **scratch**.

**Jika scratch:**

- HDLBoard tetap menjadi referensi ide.
- Jangan menyalin kode dari HDLBoard kecuali sudah diputuskan menerima kewajiban GPL.
- Komponen yang dapat dipakai dari ekosistem: Monaco atau CodeMirror (editor), parser VCD/GHW atau WaveDrom (waveform), xterm.js (terminal), GHDL dan Icarus di dalam container.
- Mulai dari MVP kecil (vertical slice) agar scope tidak membengkak: editor, GHDL, waveform, switch/LED.

**Deliverable keputusan:** satu dokumen decision record (`docs/[DECISIONS.md](http://DECISIONS.md)`, entri ADR-001) berisi jawaban kelima pertanyaan, bukti (file/bagian kode yang diperiksa), dan keputusan akhir.

## 2.3 Licensing

HDLBoard menggunakan GPL-2.0.

- Jika fork: seluruh pengembangan turunan wajib memperhatikan ketentuan lisensi, termasuk kewajiban distribusi source code ketika mendistribusikan karya turunan dalam kondisi yang diatur GPL. Pertahankan informasi copyright dan lisensi upstream, dan dokumentasikan kontribusi serta perubahan ACSL.
- Jika scratch tanpa menyalin kode HDLBoard: tidak ada kewajiban GPL dari HDLBoard, tetapi lisensi dependensi lain (misalnya GHDL, Icarus Verilog) tetap harus ditinjau.
- Untuk kepastian hukum, konsultasikan dengan pihak yang berwenang di institusi.

---

# 3. Curriculum Requirements

Fitur dikembangkan berdasarkan kebutuhan modul praktikum ACSL.

## 3.1 Curriculum Mapping


| Module   | Subject                       | Virtual Components                   | Mode (dugaan awal) |
| -------- | ----------------------------- | ------------------------------------ | ------------------ |
| Briefing | FPGA Introduction             | Board Overview, Design Flow Overview | Panduan            |
| Bab 1    | Basic VHDL                    | HDL Editor                           | Behavioral Sim     |
| Bab 2    | Data Types and Operators      | HDL Editor                           | Behavioral Sim     |
| Bab 3    | RTL Analysis and Arithmetic   | Simulator, Waveform                  | Behavioral Sim     |
| Bab 4    | UART, FTDI, Sensor, Pmod      | LDR, UART, Serial Terminal           | Board Flow         |
| Bab 5    | Seven Segment and Push Button | 7-Segment, Buttons                   | Board Flow         |
| Bab 6    | Finite State Machine          | Traffic Light, FSM                   | Board Flow         |
| Bab 7    | Arithmetic Logic Unit         | ALU, Binary Input/Output             | Board Flow         |


Catatan: daftar tersebut merupakan pemetaan awal berdasarkan modul yang telah dibahas. Agent wajib memeriksa kembali seluruh materi resmi dan contoh source code sebelum menetapkan implementasi final.

## 3.2 Bab 1: Basic VHDL

Requirements:

- VHDL editor.
- Entity declaration.
- Architecture declaration.
- Library declaration.
- Analyze source code.
- Simulation.
- Error reporting.

Expected output: mahasiswa dapat menulis kode VHDL sederhana dan melihat hasil simulasi.

## 3.3 Bab 2: Data Types and Operators

Requirements:

- Integer.
- Boolean.
- STD_LOGIC.
- STD_LOGIC_VECTOR.
- Array.
- Logical operators.
- Arithmetic operators.
- Comparison operators.

Simulation harus mendukung berbagai tipe data dan operasi VHDL yang digunakan dalam modul.

## 3.4 Bab 3: RTL Analysis and Arithmetic

Requirements:

- RTL analysis.
- Arithmetic circuits.
- Signal visualization.
- Waveform viewer.
- Simulation result inspection.

RTL schematic merupakan fitur tambahan yang perlu dievaluasi terpisah (misalnya via ghdl-yosys-plugin, belum diverifikasi).

Jangan mengklaim bahwa GHDL dapat menggantikan seluruh proses synthesis dan implementation Vivado. Jika diperlukan, integrasi toolchain FPGA seperti Vivado dapat dipertimbangkan pada tahap lanjutan.

## 3.5 Bab 4: UART, Sensor and Pmod

Bab ini memerlukan komponen virtual tambahan.

### Virtual Sensor

Komponen pertama yang wajib didukung adalah LDR.

Requirements:

- Adjustable light intensity atau mode terang/gelap.
- Digital sensor input.
- Connection to FPGA input.
- Real-time input changes.
- Sensor state visualization.

Perhatikan perbedaan antara sensor digital dan analog. Jika rangkaian praktikum hanya menggunakan input digital LDR, simulator tidak perlu mengimplementasikan ADC analog yang tidak digunakan.

### UART Simulation

Requirements:

- UART TX.
- UART RX.
- Configurable baud rate.
- Serial data transmission.
- Serial data reception.
- ASCII output.
- Serial communication monitoring.

Default baud rate untuk contoh praktikum Bab 4: 9600 baud. Konfigurasi harus tetap dapat disesuaikan dengan source code praktikum.

### Virtual Serial Terminal

Buat terminal serial di dalam aplikasi.

Requirements:

- Display received text.
- Send text to simulated UART RX.
- Clear terminal.
- Connection status.
- Baud rate configuration.
- Timestamp opsional.
- Auto-scroll.

Tampilan dan perilaku terminal terinspirasi dari PuTTY.

### PuTTY Compatibility

Sediakan kemungkinan koneksi dengan PuTTY melalui serial bridge atau TCP connection. Namun, fitur ini tidak boleh menjadi syarat untuk menjalankan praktikum. Virtual terminal internal tetap menjadi pilihan utama.

---

# 4. Nexys A7 Virtual Board

## 4.1 Board Requirements

Board virtual harus merepresentasikan komponen fisik Digilent Nexys A7 yang digunakan ACSL.

Referensi: [https://digilent.com/reference/programmable-logic/nexys-a7/start](https://digilent.com/reference/programmable-logic/nexys-a7/start)


| Component     | Requirement                  |
| ------------- | ---------------------------- |
| Clock         | 100 MHz source               |
| Switch        | 16 switches                  |
| LED           | 16 LEDs                      |
| Push Button   | 5 buttons                    |
| Seven Segment | 8 digits                     |
| Pmod          | Virtual peripheral interface |
| Reset         | Active-low reset             |


Jumlah dan pemetaan komponen wajib diverifikasi terhadap varian Nexys A7 yang benar-benar digunakan lab (misalnya A7-50T atau A7-100T) dan terhadap reset yang dipakai (CPU RESET di board).

## 4.2 I/O Mapping dan Board Profile

Jangan mengandalkan nama port dari board lain.

Buat konfigurasi khusus Nexys A7. Mapping harus mengacu pada:

1. Official Nexys A7 master XDC.
2. Board reference manual.
3. Source code praktikum ACSL.
4. Hardware yang digunakan laboratorium.

Simpan konfigurasi board secara terpisah dari simulator dan frontend. **Board profile adalah satu sumber kebenaran** untuk: daftar pin fisik, nama pin board, komponen yang terhubung ke pin tersebut, dan polaritas sinyal. Design Flow (bab 7) memakai board profile yang sama untuk I/O Planning.

Contoh konseptual (bukan format final, bukan format HDLBoard):

```json
{
  "board": "acsl-nexys-a7",
  "clock": { "frequency": 100000000, "port": "CLK100MHZ" },
  "switches": { "count": 16 },
  "leds": { "count": 16 },
  "buttons": { "count": 5 },
  "sevenSegment": { "digits": 8 },
  "pins": [
    { "package_pin": "<dari XDC resmi>", "board_name": "<dari XDC resmi>", "component": "led[0]", "direction": "out", "polarity": "active-high" }
  ]
}

```

Nilai pin pada contoh sengaja tidak diisi. Semua nilai wajib diambil dari XDC resmi dan diverifikasi.

## 4.3 Seven Segment

Requirements:

- 8 individual digits.
- Seven-segment display.
- Decimal point.
- Multiplexing support.
- Active-low segment behavior.
- Active-low digit selection.
- Real-time display updates.

Simulator harus mampu membaca sinyal segment dan digit enable dari hasil simulasi. Jangan hanya membuat display yang menerima angka secara langsung dari frontend. Seven segment harus mengikuti output sinyal HDL.

## 4.4 Push Button

Requirements:

- Center.
- Up.
- Down.
- Left.
- Right.
- Press/release state.
- Correct signal polarity.
- Reset behavior.

## 4.5 LED and Switch

Requirements:

- 16 independent switches.
- 16 independent LEDs.
- Interactive switches.
- Real-time LED updates.
- Correct bit indexing.
- Correct signal polarity.

## 4.6 Board State (Powered vs Programmed)

Board virtual memiliki state yang mengikuti Design Flow:


| State         | Kondisi                                          | Perilaku                                                                                                  |
| ------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `unconnected` | Hardware Manager belum Auto Connect              | Board tampil redup, tidak ada target terdeteksi                                                           |
| `connected`   | Auto Connect berhasil, belum diprogram           | Board terdeteksi, switch dan LED belum berfungsi (seperti FPGA kosong)                                    |
| `programmed`  | Program Device sukses                            | Board hidup, simulasi berjalan memakai pin mapping dari I/O Planning                                      |
| `stale`       | Source atau constraint berubah setelah diprogram | Board tetap menjalankan bitstream lama, UI menandai bahwa desain sudah berubah dan perlu di-program ulang |


Frontend tidak boleh menampilkan komponen board sebagai hidup sebelum state `programmed` pada mode Board Flow.

---

# 5. Bab 6: FSM and Traffic Light

Buat visualisasi FSM dan traffic light.

Requirements:

- Red light.
- Yellow light.
- Green light.
- State transition visualization.
- Clock-driven behavior.
- Reset.
- State indicator.
- Optional countdown display.

Traffic light harus mengikuti output simulasi HDL, bukan sekadar animasi frontend. Jika state berubah dalam simulator, visualisasi harus ikut berubah.

---

# 6. Bab 7: Arithmetic Logic Unit

Buat ALU visualizer untuk mendukung praktikum.

Komponen yang dibutuhkan berdasarkan materi:

- Half Adder.
- Full Adder.
- 3-bit Adder.
- Full Subtractor.
- 3-bit Subtractor.
- 3-bit Multiplier.
- 3-bit Comparator.
- ALU.

Requirements:

- Binary input controls.
- Operation selection.
- Result visualization.
- Carry output.
- Borrow output jika relevan.
- Comparison result.
- Real-time signal updates.

Semua output harus berasal dari hasil simulasi HDL. Frontend hanya bertugas menampilkan dan mengirimkan input.

---

# 7. Vivado-style Design Flow

Bagian ini adalah fitur pembeda utama proyek. Tujuannya: praktikan memahami **urutan kerja** pada board asli, tanpa harus memakai Vivado dan board fisik.

## 7.1 Prinsip

1. Urutan langkah mengikuti Vivado.
2. **Nyata:** analisis HDL (Synthesis), I/O Planning (pin mapping), dan perilaku board setelah Program Device.
3. **Simulasi edukatif:** Implementation dan Generate Bitstream (progress, delay, log, penjelasan). Tidak ada hasil bermakna yang bisa disimulasikan di tahap ini.
4. Setiap langkah menampilkan **penjelasan** agar praktikan paham fungsinya.
5. Urutan dipaksa lewat aturan dependensi, bukan hanya disarankan.
6. Langkah simulasi edukatif harus diberi label (misalnya badge "Simulasi edukatif") agar tidak menyesatkan.

## 7.2 Daftar Langkah


| #   | Langkah                               | Padanan Vivado                            | Sifat              | Perilaku di web                                                                                                                                           |
| --- | ------------------------------------- | ----------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Run Synthesis                         | Run Synthesis                             | **Nyata sebagian** | Menjalankan analyze dan elaborate (GHDL atau Icarus) terhadap source. Error ditampilkan di Problems/Console. Progress dan log tambahan bersifat edukatif. |
| 2   | Open Synthesized Design, I/O Planning | Open Synthesized Design, Window I/O Ports | **Nyata**          | Daftar port top-level dibaca dari desain. Praktikan memilih pin Nexys A7 untuk tiap port. Hasil disimpan sebagai constraint (setara XDC).                 |
| 3   | Run Implementation                    | Run Implementation                        | Simulasi edukatif  | Progress dan delay, log place and route, penjelasan.                                                                                                      |
| 4   | Generate Bitstream                    | Generate Bitstream                        | Simulasi edukatif  | Progress dan delay, penjelasan. Menjalankan pengecekan constraint (7.5).                                                                                  |
| 5   | Open Hardware Manager                 | Open Hardware Manager                     | UI                 | Membuka panel Hardware Manager.                                                                                                                           |
| 6   | Open Target, Auto Connect             | Open Target, Auto Connect                 | UI dengan state    | Mendeteksi board virtual. Board state menjadi `connected`.                                                                                                |
| 7   | Program Device                        | Program Device                            | **Nyata** (efek)   | Progress, lalu simulasi berjalan memakai pin mapping dan board menjadi `programmed`.                                                                      |


Nama menu dan teks UI mengikuti versi Vivado yang dipakai lab (perlu diverifikasi).

## 7.3 State Machine per Langkah

Setiap langkah (1, 3, 4, 7) punya status:


| Status     | Arti                                                   |
| ---------- | ------------------------------------------------------ |
| `not_run`  | Belum pernah dijalankan                                |
| `running`  | Sedang berjalan (progress, tombol dikunci)             |
| `done`     | Berhasil dan up to date                                |
| `failed`   | Gagal (error ditampilkan, langkah berikutnya terkunci) |
| `outdated` | Pernah `done`, tetapi input berubah                    |


## 7.4 Aturan Dependensi dan Invalidasi

**Prasyarat:**

- Run Implementation memerlukan Synthesis `done`.
- Generate Bitstream memerlukan Implementation `done`.
- Open Hardware Manager boleh dibuka kapan saja (seperti Vivado), tetapi Program Device memerlukan bitstream `done`.
- Auto Connect memerlukan Hardware Manager terbuka.
- Program Device memerlukan target `connected` dan bitstream `done`.

**Invalidasi (usulan, verifikasi dengan perilaku Vivado):**


| Perubahan                         | Dampak                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Source HDL berubah                | Synthesis, Implementation, Bitstream menjadi `outdated`. Board `programmed` menjadi `stale`.                                                    |
| Pin assignment/constraint berubah | Implementation dan Bitstream menjadi `outdated`. Synthesis tetap `done` (penyederhanaan, bisa disesuaikan). Board `programmed` menjadi `stale`. |
| Top module berubah                | Semua langkah menjadi `outdated`.                                                                                                               |


## 7.5 Dialog dan Perilaku Saat Melompati Langkah

Meniru Vivado: jika praktikan melompat, tampilkan dialog yang menjelaskan, lalu tawarkan menjalankan langkah yang kurang secara otomatis.


| Aksi               | Kondisi                       | Respons                                                                                                                                                                                                                                |
| ------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generate Bitstream | Implementation belum `done`   | Dialog: implementation belum tersedia, tawarkan menjalankan implementation. Jika Yes, jalankan Synthesis (jika perlu), lalu Implementation, lalu Generate Bitstream secara berurutan dengan progress masing-masing. Jika No, batalkan. |
| Run Implementation | Synthesis belum `done`        | Dialog serupa, tawarkan menjalankan Synthesis dulu.                                                                                                                                                                                    |
| Program Device     | Bitstream belum `done`        | Aksi dinonaktifkan atau menampilkan pesan bahwa file bitstream belum tersedia.                                                                                                                                                         |
| Auto Connect       | Hardware Manager belum dibuka | Tombol tidak tersedia.                                                                                                                                                                                                                 |
| Run (apa pun)      | Langkah sebelumnya `failed`   | Tampilkan alasan dan arahkan ke langkah yang gagal.                                                                                                                                                                                    |
| Generate Bitstream | Ada port top-level tanpa pin  | Gagal dengan pesan setara DRC "unconstrained logical port" (verifikasi perilaku Vivado yang dipakai lab: error atau warning). Praktikan diarahkan kembali ke I/O Planning.                                                             |


Teks dialog final mengikuti Vivado versi yang dipakai lab (verifikasi). Teks dan penjelasan disimpan sebagai konten terpisah (7.7), bukan hardcode di komponen UI.

## 7.6 I/O Planning (Nyata)

Requirements:

- Membaca daftar port top-level (nama, arah, lebar vektor) dari hasil analisis, bukan input manual.
- Untuk tiap port, praktikan memilih pin dari board profile (4.2), misalnya port `led[0]` dipetakan ke LED0.
- Mendukung vektor (`std_logic_vector`) per bit.
- Validasi: pin ganda, arah tidak cocok (output ke switch), port belum dipetakan.
- I/O standard disesuaikan dengan board profile (LVCMOS33 pada Nexys A7, verifikasi).
- Constraint ditampilkan dan dapat diedit dalam bentuk XDC (viewer minimal, editor opsional).
- Praktikan boleh mengimpor XDC yang diberikan modul praktikum.
- Pin assignment benar-benar menentukan hubungan antara port HDL dan komponen board virtual. Jika praktikan salah pin, LED atau komponen yang menyala juga salah, sama seperti di board asli.

## 7.7 Konten Penjelasan

Setiap langkah punya panel penjelasan dengan tiga bagian:

1. **Apa yang dilakukan Vivado asli** pada langkah ini.
2. **Mengapa langkah ini diperlukan.**
3. **Apa yang terjadi di simulator ini** (nyata atau simulasi edukatif).

Konten disimpan terpisah (misalnya file JSON/Markdown per langkah dan per bahasa) agar dosen atau asisten dapat mengubahnya tanpa mengubah kode.

## 7.8 Delay dan Progress

- Durasi delay dapat dikonfigurasi per langkah (default pendek, masuk akal untuk edukasi).
- Opsi "skip animation" untuk pengguna berulang.
- Log bersifat edukatif dan tidak boleh menampilkan angka laporan yang menyesatkan (misalnya angka utilization atau timing yang dikarang). Jika laporan ditampilkan, harus diberi label "ilustrasi".
- Langkah yang berjalan tidak boleh diganggu oleh aksi lain yang bergantung padanya (tombol dikunci).

## 7.9 Acceptance Criteria Design Flow

- Urutan langkah sesuai tabel 7.2.
- Semua aturan dependensi dan dialog 7.4 dan 7.5 berfungsi dan memiliki test.
- Error syntax HDL muncul pada langkah Synthesis dan menghentikan alur.
- I/O Planning mengubah perilaku board virtual (pin salah menghasilkan perilaku salah).
- Perubahan source atau constraint menandai langkah terkait `outdated` dan board `stale`.
- Program Device tidak bisa dijalankan sebelum bitstream `done` dan target `connected`.
- Langkah simulasi edukatif diberi label.
- Teks penjelasan dapat diubah tanpa mengubah kode.

---

# 8. System Architecture

## 8.1 High-Level Architecture

```
                 ACSL VIRTUAL FPGA LAB
                          |
            +-------------+-------------+
            |                           |
       Frontend                     Backend
            |                           |
   +--------+---------+         +-------+--------+---------+
   |        |         |         |       |        |         |
 Editor   Virtual   Waveform  Project  Design   Simulation  Auth/
          Board              Manager   Flow     Manager     Storage
   |        |                   |      Manager      |
   +--------+-------------------+----------+--------+
                            |
                     Simulation Engine
                            |
                 +----------+----------+
                 |                     |
                GHDL              Icarus Verilog
                 |                     |
              VHDL Simulation       Verilog Simulation
                 |                     |
                 +----------+----------+
                            |
                      Signal Output
                            |
               Virtual Board / Terminal

```

Diagram tersebut merupakan target arsitektur logis. Implementasi harus disesuaikan dengan hasil audit dan keputusan fork atau scratch (2.2).

Komponen baru: **Design Flow Manager** (state machine langkah, dependensi, invalidasi, pin mapping/constraint) dan **Auth/Storage** (akun dan project, bab 14).

## 8.2 Architecture Principles

- Frontend tidak menjalankan simulator secara langsung.
- Backend bertanggung jawab terhadap proses simulasi.
- Setiap project memiliki konfigurasi sendiri (termasuk constraint/pin mapping).
- Setiap simulasi berjalan dalam isolated environment.
- Input dan output board harus mempunyai interface yang konsisten.
- Simulator harus dapat dikembangkan tanpa mengubah seluruh frontend.
- **Status Design Flow disimpan dan divalidasi di backend**, bukan hanya di frontend, agar urutan tidak bisa dilewati lewat manipulasi klien.

## 8.3 Simulation Lifecycle

Mode Behavioral Simulation:

```
User writes HDL + testbench
     |
     v
Save Project -> Validate Files -> Analyze -> Elaborate -> Run -> Waveform / Console

```

Mode Board Flow:

```
User writes HDL
     |
     v
Save Project
     |
     v
[1] Run Synthesis  (Validate, Analyze, Elaborate; nyata)
     |
     v
[2] I/O Planning   (pin mapping -> constraint; nyata)
     |
     v
[3] Run Implementation   (edukatif)
     |
     v
[4] Generate Bitstream   (edukatif + cek constraint)
     |
     v
[5-6] Hardware Manager, Auto Connect
     |
     v
[7] Program Device  -> Start Simulation dengan pin mapping
     |
     v
Process Input Signals -> Read Output Signals -> Update Virtual Board

```

Jangan menganggap Analyze, Elaborate, dan Run sebagai satu proses yang sama. Error pada setiap tahap harus ditampilkan secara terpisah.

---

# 9. HDL Compatibility

## 9.1 GHDL

VHDL simulator menggunakan GHDL.

Requirements:

- VHDL-93 compatibility.
- VHDL-2008 compatibility.
- Standard IEEE libraries.
- Synopsys compatibility where required.
- Multi-file compilation.
- Dependency ordering.
- Error reporting.
- Simulation control.

### Important: Synopsys Compatibility

Contoh kode dari praktikum ACSL menggunakan:

```vhdl
use IEEE.std_logic_arith.ALL;
use IEEE.std_logic_unsigned.ALL;

```

GHDL mengeluarkan error:

```
use of synopsys package "std_logic_arith"
needs the -fsynopsys option

```

Perbaiki konfigurasi GHDL agar kompatibel. Contoh command:

```
ghdl -a --std=08 -fsynopsys source.vhdl

```

Agent wajib mengaudit seluruh command pipeline, termasuk analyze, elaboration, dan run. Jangan hanya menambahkan flag pada satu command. Jangan otomatis mengubah source code praktikum.

### Important Compatibility Rules

- Pertahankan urutan dependency.
- Pastikan package dianalisis sebelum entity yang menggunakannya.
- Tangani library yang diperlukan.
- Hindari konflik antara konfigurasi VHDL project.
- Pertahankan error asli dari GHDL agar mudah di-debug.

## 9.2 Icarus Verilog

Requirements:

- Verilog simulation.
- Compilation.
- Elaboration.
- Runtime simulation.
- Error reporting.
- Signal output integration.

Pastikan penggunaan Icarus tidak mengganggu pipeline GHDL.

---

# 10. Virtual Board Simulation Interface

## 10.1 Signal Adapter

Buat interface yang menghubungkan simulator dengan komponen virtual.

```
Simulation Engine
       |
       v
Signal Adapter  <---- Pin Mapping (dari I/O Planning + Board Profile)
       |
       +---- Input Signals
       |         |
       |      Virtual Switch
       |      Virtual Button
       |      Virtual Sensor
       |
       +---- Output Signals
                 |
              Virtual LED
              Seven Segment
              Traffic Light
              UART Terminal

```

Requirements:

- Bidirectional signal mapping.
- Pin mapping dari Design Flow menentukan port HDL mana yang terhubung ke komponen board mana.
- Input state management.
- Output state management.
- Signal update synchronization.
- Simulation clock management.
- Error handling.

Frontend tidak boleh menjadi sumber kebenaran bagi output HDL. Semua output harus berasal dari simulator.

## 10.2 Interactive Input Mechanism (Perlu Evaluasi)

Switch, button, dan sensor harus bisa diubah saat simulasi berjalan. Mekanisme teknis belum ditetapkan dan harus dievaluasi pada Phase 0/1 lewat prototipe kecil. Kandidat:

1. Bridge ke simulator (misalnya VHPIDIRECT pada GHDL, VPI pada Icarus) untuk membaca/menulis sinyal saat runtime.
2. Wrapper/testbench yang dibangkitkan otomatis dari pin mapping dan membaca input dari pipe atau file.
3. Simulasi bertahap (chunked) dengan state input per chunk.

Kriteria pemilihan: latensi input, kompatibilitas dengan source praktikum tanpa modifikasi, kemudahan sandbox, dan stabilitas.

## 10.3 Simulated Time vs Real Time

Clock Nexys A7 adalah 100 MHz. Praktikum biasanya memakai clock divider (misalnya blink 1 Hz, refresh seven-segment, baud rate UART). Simulasi logika tingkat RTL pada 100 MHz secara real time tidak realistis, sehingga desain seperti blink 1 Hz dapat membutuhkan puluhan juta cycle.

Requirements:

- Tampilkan **simulated time** dan indikator kecepatan simulasi (rasio terhadap real time).
- Sediakan kontrol kecepatan (misalnya jalankan secepat mungkin, jeda, step per N cycle).
- Dokumentasikan batas performa dan contoh praktikum yang terdampak (blink 1 Hz, delay UART).
- Jangan mengubah source praktikum untuk mempercepat simulasi.
- Opsi yang dapat dievaluasi: override generic/parameter dari luar (dengan persetujuan), atau mode "fast-forward" yang dijelaskan ke praktikan.
- Ukur performa nyata GHDL/Icarus pada contoh praktikum di Phase 1 sebelum menetapkan solusi.

---

# 11. User Interface and Experience

## 11.1 Main Workspace

Target interface:

```
+--------------------------------------------------------------+
| ACSL Virtual FPGA     [Mode: Sim | Board]        Project / Run |
+----------------+---------------------------------------------+
|                |                                             |
| Project Files  |            Virtual Nexys A7                 |
|                |                                             |
| source.vhdl    |       [ Switches ] [ LEDs ]                 |
| testbench.vhdl |                                             |
| constraints.xdc|       [ Seven Segment ]                     |
|                |                                             |
+----------------+---------------------------------------------+
| Flow Navigator: 1 Synthesis > 2 I/O Planning > 3 Impl >      |
|                 4 Bitstream > 5 Hardware Manager             |
+--------------------------------------------------------------+
| HDL Editor                                                   |
|                                                              |
|  VHDL / Verilog source code                                  |
+--------------------------------------------------------------+
| Console | Waveform | Serial Terminal | Problems | Explanation |
+--------------------------------------------------------------+

```

Ini adalah konsep layout, bukan keharusan meniru tampilan HDLBoard atau Vivado secara persis.

## 11.2 Main Interface Components

- Project explorer.
- HDL editor.
- Virtual board.
- **Flow Navigator** (daftar langkah dengan status `not_run/running/done/failed/outdated`).
- **I/O Planning panel** dan constraint viewer.
- **Hardware Manager panel.**
- **Explanation panel** (7.7).
- Simulation controls.
- Console.
- Problems panel.
- Waveform viewer.
- Serial terminal.

## 11.3 Simulation Controls

- Analyze.
- Run.
- Stop.
- Reset.
- Restart.
- Clear output.

Jika fondasi yang dipilih sudah menyediakan fungsi serupa, gunakan implementasi yang tersedia dan sesuaikan seperlunya.

## 11.4 UX Principles

- Clean interface.
- Professional laboratory appearance.
- Responsive layout.
- Dark and light theme jika sesuai dengan kemampuan fondasi.
- Clear error messages.
- No unnecessary animations.
- Keyboard-friendly editor.
- Suitable for desktop and laptop.
- Status langkah selalu terlihat jelas.
- Pesan dialog dan penjelasan berbahasa Indonesia (bahasa lain opsional).

Prioritaskan desktop karena praktikum membutuhkan editor dan virtual board secara bersamaan.

---

# 12. Technology Stack

Jika fork: gunakan stack aktual HDLBoard sebagai prioritas dan jangan mengganti framework tanpa alasan teknis.

Jika scratch: pilih stack yang dikuasai tim, dengan alasan tertulis di `docs/[DECISIONS.md](http://DECISIONS.md)`.

Kandidat teknologi:


| Requirement        | Technology                                                         |
| ------------------ | ------------------------------------------------------------------ |
| VHDL               | GHDL                                                               |
| Verilog            | Icarus Verilog                                                     |
| Code Editor        | Existing editor (jika fork), Monaco/CodeMirror (jika scratch)      |
| Waveform           | Existing implementation (jika fork), VCD/GHW viewer (jika scratch) |
| Serial Terminal    | xterm.js or equivalent                                             |
| Communication      | WebSocket                                                          |
| Sensor Simulation  | Custom peripheral adapter                                          |
| Process Isolation  | Container or equivalent sandbox                                    |
| Design Flow state  | Backend state machine, tersimpan per project                       |
| Frontend / Backend | Mengikuti keputusan 2.2                                            |


Teknologi tambahan hanya boleh digunakan jika memang dibutuhkan.

---

# 13. Security and Execution Isolation

Simulator akan menerima source code dari mahasiswa. Karena itu, security merupakan requirement utama.

Requirements:

- Isolated simulation process.
- Restricted filesystem access.
- No unrestricted shell execution.
- CPU limits.
- Memory limits.
- Execution timeout.
- Temporary project directories.
- Safe cleanup.
- Restricted network access.
- Controlled process termination.
- Validasi input constraint/XDC dan nama file (cegah path traversal dan injeksi command).
- Rate limiting per user pada Run/Program Device.

Jangan menjalankan source code pengguna dengan akses penuh ke host server. Jangan menganggap menjalankan GHDL atau Icarus dalam subprocess otomatis membuat eksekusi aman.

---

# 14. Akun, Project, dan Peran

## 14.1 Akun dan Login

Requirements:

- Praktikan memiliki akun agar project tersimpan.
- Metode login belum ditetapkan (akun lokal, SSO kampus, atau lainnya). Lihat Open Questions.
- Sesi simulasi terikat ke akun.

## 14.2 Project Persistence

Requirements:

- Project tersimpan per pengguna: source, testbench, constraint, pengaturan top module, status Design Flow.
- Daftar project dan kemampuan membuka kembali, menduplikasi, dan menghapus.
- Template project per modul praktikum (Bab 1 sampai 7) yang dapat dimuat praktikan.
- Export dan import project (zip).
- Kuota penyimpanan per pengguna.

## 14.3 Peran


| Peran       | Kemampuan                                                                           |
| ----------- | ----------------------------------------------------------------------------------- |
| Praktikan   | Membuat dan menjalankan project sendiri                                             |
| Asisten     | (Fase lanjut) Melihat project praktikan, mengelola template modul                   |
| Dosen/Admin | (Fase lanjut) Mengelola akun, template, konten penjelasan, dan konfigurasi resource |


Peran Asisten dan Dosen/Admin dapat ditunda setelah MVP. Rancang model data agar peran bisa ditambahkan tanpa migrasi besar.

---

# 15. Non-Functional Requirements

Nilai target berikut adalah **usulan awal** dan harus dikonfirmasi dengan lab dan infrastruktur yang tersedia.


| Aspek            | Requirement                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Concurrent users | Target belum ditetapkan (isi berdasarkan ukuran kelas praktikum)                                             |
| Isolasi          | Satu sesi simulasi per proses terisolasi, tidak berbagi state                                                |
| Resource         | Batas CPU, memori, dan waktu per sesi (nilai ditentukan setelah pengukuran di Phase 1)                       |
| Antrian          | Jika kapasitas penuh, permintaan masuk antrian dengan indikator posisi                                       |
| Latensi input    | Perubahan switch/button tampil di simulator dalam waktu yang terasa real time (target diukur pada prototipe) |
| Ketersediaan     | Platform dapat diakses selama jadwal praktikum                                                               |
| Browser          | Browser desktop modern (daftar resmi ditentukan kemudian)                                                    |
| Logging          | Log eksekusi dan error disimpan untuk debugging, tanpa menyimpan data sensitif yang tidak perlu              |
| Backup           | Backup project pengguna berkala                                                                              |
| Aksesibilitas    | Keyboard-friendly, kontras warna memadai                                                                     |


---

# 16. Development Roadmap

## Phase 0: Repository Audit and Decision

Priority: Critical.

Tasks:

1. Fork HDLBoard (untuk audit) dan clone.
2. Baca dokumentasi proyek.
3. Inspeksi struktur repository.
4. Identifikasi arsitektur frontend dan backend.
5. Identifikasi pipeline GHDL dan Icarus.
6. Inspeksi board configuration.
7. Inspeksi komunikasi sinyal dan waveform.
8. Identifikasi batasan upstream.
9. Prototipe kecil mekanisme input interaktif (10.2).
10. Isi decision gate fork vs scratch (2.2) dan tulis ADR-001.

Deliverables:

- Repository architecture report.
- Existing feature inventory.
- Keputusan fork atau scratch (`docs/[DECISIONS.md](http://DECISIONS.md)`).
- Modification plan.
- Technical risk assessment.

Do not start large-scale implementation during this phase.

## Phase 1: ACSL Foundation

Priority: Critical.

Tasks:

1. Konfigurasi development environment.
2. Perbaiki kompatibilitas GHDL Synopsys.
3. Validasi VHDL-2008.
4. Validasi dukungan multi-file project.
5. Uji fungsi Icarus Verilog.
6. Ukur performa simulasi pada contoh praktikum (10.3).
7. Bangun regression tests.
8. Dokumentasikan simulator commands.

Acceptance Criteria:

- Basic VHDL project works.
- Kode ACSL dengan `std_logic_arith` dan `std_logic_unsigned` dapat dianalisis.
- Hasil pengukuran performa terdokumentasi.
- Tidak ada regression pada fungsi simulator yang sudah ada (jika fork).

## Phase 2: Nexys A7 Board

Priority: Critical.

Tasks:

1. Buat board profile ACSL Nexys A7 dari XDC resmi.
2. Verifikasi pin dan signal mapping.
3. Implementasikan switch.
4. Implementasikan LED.
5. Implementasikan push button.
6. Implementasikan clock.
7. Implementasikan reset.
8. Implementasikan seven segment.
9. Implementasikan board state (4.6).
10. Uji polaritas output.

Acceptance Criteria:

- Semua komponen board virtual merespons dengan benar.
- Signal mapping sesuai hardware terdokumentasi.
- Seven-segment output benar.
- Push button sesuai perilaku hardware.
- Tidak ada mapping hardcoded yang tersebar di kode frontend.

## Phase 3: Vivado-style Design Flow

Priority: Critical.

Tasks:

1. Implementasikan Design Flow Manager (state machine, dependensi, invalidasi) di backend.
2. Hubungkan Run Synthesis dengan analyze/elaborate nyata.
3. Implementasikan I/O Planning dan constraint (XDC) berbasis board profile.
4. Implementasikan Implementation dan Generate Bitstream (edukatif) beserta pengecekan constraint.
5. Implementasikan Hardware Manager, Open Target, Auto Connect, Program Device.
6. Implementasikan dialog lompat langkah (7.5).
7. Implementasikan panel penjelasan dan konten terpisah (7.7).
8. Hubungkan Program Device ke Signal Adapter dengan pin mapping.
9. **Vertical slice:** contoh switch ke LED dari editor sampai Program Device.

Acceptance Criteria: lihat 7.9.

## Phase 4: Bab 1 sampai 3 Simulation

Priority: High.

Tasks:

1. Uji basic VHDL.
2. Uji data types.
3. Uji operators.
4. Uji arrays.
5. Uji arithmetic.
6. Uji waveform.
7. Uji kemampuan RTL inspection.

Acceptance Criteria:

- Praktikan dapat mengikuti tiga modul praktikum pertama.
- Source dapat dianalisis dan disimulasikan.
- Error mudah dipahami.
- Waveform dapat diperiksa.

## Phase 5: Bab 5 and Bab 6 Components

Priority: High.

Tasks:

1. Integrasi seven-segment.
2. Integrasi push button.
3. Uji up/down counter.
4. Uji binary-to-BCD.
5. Visualisasi state FSM.
6. Visualisasi traffic light.
7. Integrasi clock dan reset.

Acceptance Criteria:

- Latihan seven-segment berfungsi.
- Latihan push button berfungsi.
- Output FSM sinkron dengan simulasi.
- Traffic light mencerminkan sinyal HDL sebenarnya.

## Phase 6: Bab 4 UART and Sensor

Priority: High.

Tasks:

1. Implementasikan LDR virtual.
2. Implementasikan abstraksi Pmod.
3. Implementasikan monitoring sinyal UART.
4. Implementasikan virtual serial terminal.
5. Implementasikan UART RX input.
6. Implementasikan UART TX output.
7. Uji 9600 baud.
8. Uji ASCII output.
9. Investigasi integrasi PuTTY eksternal.

Acceptance Criteria:

- Input LDR dapat diubah interaktif.
- FPGA menerima state sensor yang benar.
- Output UART tampil di terminal virtual.
- Terminal mendukung alur komunikasi yang dibutuhkan modul.
- Integrasi PuTTY bersifat opsional.

## Phase 7: Bab 7 ALU

Priority: Medium.

Tasks:

1. Half Adder.
2. Full Adder.
3. 3-bit Adder.
4. Full Subtractor.
5. 3-bit Subtractor.
6. 3-bit Multiplier.
7. 3-bit Comparator.
8. Visualisasi ALU.

Acceptance Criteria:

- Input dapat diubah interaktif.
- Output sesuai simulasi HDL.
- Carry dan comparison signal terlihat.
- Hasil aritmetika dapat divalidasi.

## Phase 8: Accounts, Projects, and Deployment

Priority: Medium.

Tasks:

1. Implementasikan akun dan login.
2. Implementasikan project persistence dan template modul.
3. Siapkan production configuration.
4. Konfigurasi reverse proxy.
5. Konfigurasi simulation isolation.
6. Konfigurasi resource limits dan antrian.
7. Konfigurasi logs.
8. Konfigurasi cleanup.
9. Deploy ke infrastruktur ACSL.
10. Jalankan integration tests dan uji beban sesuai target NFR.

Acceptance Criteria:

- Platform dapat diakses melalui domain ACSL yang dituju.
- Beberapa pengguna dapat menjalankan sesi independen.
- Proses simulasi terisolasi.
- Sesi gagal dapat dihentikan dan dibersihkan.
- Project pengguna tersimpan dan dapat dibuka kembali.

## Phase 9 (Opsional): Peran Asisten/Dosen

- Melihat project praktikan.
- Mengelola template modul dan konten penjelasan.
- Dashboard penggunaan.

---

# 17. Testing Strategy

Setiap fitur harus memiliki test case.

## 17.1 HDL Tests

- Basic VHDL entity.
- Multiple architectures.
- VHDL-2008.
- Synopsys packages.
- Multiple source files.
- Invalid source code.
- Verilog basic simulation.
- Testbench simulation.

## 17.2 Nexys A7 Tests

- Switch to LED.
- Push button to LED.
- Reset.
- Clock.
- Seven-segment digit selection.
- Seven-segment segment output.
- Multiplexing.

## 17.3 Design Flow Tests

- Urutan benar: semua langkah berjalan sampai Program Device.
- Generate Bitstream tanpa Implementation menampilkan dialog dan menjalankan langkah yang kurang secara berurutan.
- Pilih "No" pada dialog membatalkan aksi tanpa efek samping.
- Run Implementation tanpa Synthesis menampilkan dialog.
- Program Device tanpa bitstream tidak bisa dijalankan.
- Error syntax pada Synthesis menghentikan alur dan terlihat di Problems.
- Port tanpa pin menyebabkan Generate Bitstream gagal dengan pesan jelas.
- Pin ganda dan arah pin tidak cocok ditolak oleh I/O Planning.
- Perubahan source menandai langkah `outdated` dan board `stale`.
- Perubahan constraint menandai Implementation dan Bitstream `outdated`.
- Pin salah menghasilkan perilaku board yang salah (bukti pin mapping nyata).
- Validasi status Design Flow dilakukan di backend (klien tidak bisa melompati langkah).
- Delay dan skip animation berfungsi.

## 17.4 UART Tests

- UART transmission.
- UART reception.
- Baud rate 9600.
- ASCII output.
- Serial terminal synchronization.
- Invalid communication settings.

## 17.5 Account and Project Tests

- Simpan, buka, duplikat, hapus project.
- Isolasi antar pengguna (tidak bisa mengakses project pengguna lain).
- Export dan import project.

## 17.6 Security and Load Tests

- Timeout dan batas memori ditegakkan.
- Percobaan akses filesystem di luar sandbox gagal.
- Pembersihan setelah sesi gagal.
- Beberapa sesi bersamaan sesuai target NFR.

## 17.7 Regression Tests

Setiap perubahan pada simulator harus menjalankan regression tests agar fitur yang sudah ada (termasuk fitur upstream jika fork) tidak rusak.

---

# 18. Out of Scope

Fitur berikut tidak menjadi prioritas versi pertama:

- General-purpose Arduino simulator.
- ESP32 simulator.
- Full microcontroller emulator.
- Full PCB design environment.
- General electronics SPICE simulation.
- Full Vivado replacement (termasuk synthesis, place and route, timing analysis, dan bitstream **nyata**).
- Laporan utilization/timing yang nyata.
- Physical FPGA programming through browser.
- Multi-board network simulation.
- Advanced analog electronics simulation.

Fitur tersebut hanya dapat dipertimbangkan jika ada kebutuhan nyata dalam kurikulum ACSL.

---

# 19. Definition of Done

Project dianggap mencapai MVP apabila:

- \[ \] Keputusan fork atau scratch terdokumentasi (ADR-001).
- \[ \] Aplikasi dasar berhasil dijalankan.
- \[ \] GHDL Synopsys compatibility berfungsi.
- \[ \] VHDL-2008 berfungsi.
- \[ \] Icarus Verilog berfungsi.
- \[ \] Nexys A7 virtual board tersedia.
- \[ \] Switch dan LED berfungsi.
- \[ \] Push button berfungsi.
- \[ \] Seven segment berfungsi.
- \[ \] **Vivado-style Design Flow berfungsi sesuai 7.9.**
- \[ \] **I/O Planning menentukan hubungan port HDL ke board virtual.**
- \[ \] Bab 1 sampai 3 dapat disimulasikan.
- \[ \] Bab 4 UART dan LDR dapat disimulasikan.
- \[ \] Bab 5 seven segment dapat disimulasikan.
- \[ \] Bab 6 FSM dan traffic light dapat disimulasikan.
- \[ \] Bab 7 ALU dapat disimulasikan.
- \[ \] Waveform dapat diperiksa.
- \[ \] **Akun dan project persistence berfungsi.**
- \[ \] Simulation process memiliki isolation dan resource limits.
- \[ \] **Performa simulasi pada contoh praktikum terukur dan batasnya terdokumentasi.**
- \[ \] Dokumentasi penggunaan tersedia.

---

# 20. Important Development Rules for AI Agents

Agent harus mengikuti aturan berikut:

1. Audit repository sebelum mengubah kode.
2. Jangan mengasumsikan struktur HDLBoard.
3. Jangan mengganti teknologi existing tanpa alasan.
4. Jangan membuat simulator HDL sendiri.
5. Jangan mengubah source code praktikum untuk menghindari masalah simulator.
6. Jangan membuat output virtual yang tidak berasal dari hasil simulasi.
7. Jangan mengasumsikan pin mapping Nexys A7.
8. Verifikasi semua mapping terhadap official XDC dan hardware lab.
9. Implementasikan fitur secara bertahap.
10. Jalankan regression tests setelah perubahan.
11. Dokumentasikan setiap perubahan.
12. Jangan mengimplementasikan fitur di luar scope tanpa persetujuan.
13. Jangan menghapus fitur upstream yang masih berguna (jika fork).
14. Jangan menampilkan fitur yang sebenarnya belum berfungsi.
15. Prioritaskan akurasi simulasi dibandingkan tampilan.
16. **Jangan menyalin kode dari HDLBoard sebelum keputusan fork atau scratch dibuat.**
17. **Langkah Design Flow yang hanya simulasi (Implementation, Bitstream) wajib diberi label simulasi edukatif.**
18. **Jangan menampilkan angka laporan (utilization, timing, dan sejenisnya) yang dikarang tanpa label "ilustrasi".**
19. **Status Design Flow wajib divalidasi di backend.**
20. **Teks dialog dan penjelasan disimpan sebagai konten terpisah, bukan hardcode di komponen UI.**
21. **Jangan menetapkan solusi performa (clock divider, simulated time) sebelum mengukur.**

---

# 21. Initial AI Agent Prompt

Gunakan prompt berikut ketika memulai project di OMP.

## TASK: Initialize ACSL Virtual FPGA Lab Development

You are acting as a Senior FPGA Software Engineer, Full-Stack Engineer, and Software Architect.

We are developing ACSL Virtual FPGA Lab, an educational FPGA lab platform. It lets students follow a Vivado-style workflow (synthesis, I/O planning, implementation, bitstream, hardware manager, program device) and run their HDL on a virtual Digilent Nexys A7, because physical boards are limited. The real HDL simulation uses GHDL and Icarus Verilog.

The open-source HDLBoard repository ([https://github.com/rlangoy/HDLBoard](https://github.com/rlangoy/HDLBoard)) is a CANDIDATE foundation. Whether to fork it or build from scratch is decided by an audit-based decision gate, not assumed.

The target hardware is Digilent Nexys A7. The official practical modules are documented at [https://fpga.acsl.my.id](https://fpga.acsl.my.id).

Your first responsibility is NOT to implement the platform. Your first responsibility is to understand the existing repository, make the fork-vs-scratch recommendation with evidence, and produce a reliable development plan.

### Step 1: Repository Audit

Inspect:

- Repository structure.
- Frontend architecture.
- Backend architecture.
- Existing board configuration.
- GHDL integration.
- Icarus Verilog integration.
- HDL compilation pipeline.
- Simulation lifecycle (does simulation run server-side or in the browser?).
- Waveform implementation.
- Input/output signal communication, including how inputs can change while a simulation is running.
- Existing security limitations.

Do not assume technologies or implementation details without inspecting the source code.

### Step 2: Fork vs Scratch Decision

Answer the five decision questions in section 2.2 of the PRD with evidence (files and code inspected). Recommend fork or scratch, and write it as ADR-001 in docs/[DECISIONS.md](http://DECISIONS.md). Wait for approval before acting on the decision.

### Step 3: Curriculum Analysis

Analyze the official ACSL documentation.

Identify:

- Practical modules.
- HDL source code.
- Required hardware components.
- Input/output signals.
- UART configuration.
- Sensor requirements.
- Seven-segment requirements.
- FSM requirements.
- ALU requirements.
- Which modules use Behavioral Simulation and which use the Board Flow.
- Which examples use clock dividers or long-running timing that affect simulation speed.

Create a curriculum-to-feature mapping.

### Step 4: Compatibility Analysis

Investigate the following error:

```
use of synopsys package "std_logic_arith"
needs the -fsynopsys option

use of synopsys package "std_logic_unsigned"
needs the -fsynopsys option

```

Determine exactly where GHDL arguments are constructed. Propose a solution that allows ACSL practical source code to work without unnecessary source modifications. Preserve existing VHDL functionality.

### Step 5: Design Flow Analysis

Read section 7 of the PRD. Propose how to implement the Vivado-style Design Flow: where the state machine lives, how step status and invalidation are stored per project, how I/O Planning reads top-level ports from the analysis result, and how the pin mapping reaches the signal adapter. Identify which steps are real and which are educational simulations. Do not invent Vivado dialog texts; list the ones that need verification against the Vivado version used by the lab.

### Step 6: Architecture Proposal

Design a modular architecture for:

- HDL Editor.
- Simulation Engine.
- Design Flow Manager.
- Nexys A7 Virtual Board and Board Profile.
- Virtual I/O and Signal Adapter.
- UART Communication.
- LDR Sensor.
- Virtual Serial Terminal.
- Waveform Viewer.
- FSM Visualization.
- ALU Visualization.
- Accounts and Project Storage.

Reuse existing components wherever it is justified by the audit.

### Step 7: Development Plan

Create:

```
docs/
├── PRD.md
├── ARCHITECTURE.md
├── CURRICULUM_MAPPING.md
├── BOARD_SPECIFICATION.md
├── SIMULATION_ENGINE.md
├── DESIGN_FLOW.md
├── DECISIONS.md
├── DEVELOPMENT_ROADMAP.md
└── TESTING_STRATEGY.md

```

Do not overwrite existing documentation without inspecting it first.

### Step 8: Report

Provide:

1. Existing architecture summary.
2. Existing feature inventory.
3. Fork vs scratch recommendation with evidence.
4. Technical limitations.
5. Required modifications.
6. Dependency requirements.
7. Proposed architecture.
8. Development roadmap.
9. Simulation performance concerns and a measurement plan.
10. Risks and recommendations.
11. Questions that need answers from the lab (section 22).

### Important Restrictions

- Do not start large-scale implementation.
- Do not rewrite the project.
- Do not replace GHDL or Icarus.
- Do not assume Nexys A7 pin mappings.
- Do not modify official practical source code.
- Do not copy HDLBoard code before the fork-vs-scratch decision is approved.
- Do not claim a feature works without testing it.
- Do not display fabricated report numbers.

First complete the audit, the decision record, and the technical specification. Wait for approval before starting major implementation.

---

# 22. Open Questions

Pertanyaan berikut perlu dijawab oleh lab/pemilik proyek. Sampai dijawab, agent harus mencatatnya sebagai asumsi terbuka dan tidak menebak.

1. Varian Nexys A7 yang dipakai lab: A7-50T atau A7-100T?
2. Versi Vivado yang dipakai praktikum (agar teks menu dan dialog sesuai)?
3. Apakah praktikum memakai file XDC yang disediakan modul, atau praktikan menulis sendiri?
4. Bab mana yang memakai Behavioral Simulation (testbench) dan mana yang memakai board? (3.1 baru dugaan)
5. Metode login: akun lokal, SSO kampus, atau lainnya?
6. Perkiraan jumlah praktikan bersamaan dan infrastruktur server yang tersedia?
7. Apakah laporan (utilization/timing) perlu ditampilkan dalam bentuk ilustrasi, atau dihilangkan?
8. Apakah asisten/dosen perlu melihat hasil praktikan pada rilis pertama?
9. Apakah bahasa antarmuka cukup bahasa Indonesia?
10. Apakah GPL pada turunan HDLBoard (jika fork) dapat diterima oleh institusi?

---

# 23. Final Project Vision

ACSL Virtual FPGA Lab should become a unified virtual environment where students can:

1. Open a practical module.
2. Write or paste HDL source code.
3. Follow the same workflow as Vivado: synthesis, I/O planning, implementation, bitstream, hardware manager, program device.
4. Assign pins to the virtual Nexys A7 and see the consequences of their choices.
5. Interact with virtual hardware.
6. Run actual HDL simulation.
7. Observe hardware outputs.
8. Inspect waveform and serial communication.
9. Understand the behavior of their digital circuits and the order of work on a real board.

The goal is not to replace physical FPGA hardware entirely. The goal is to make FPGA practical learning more accessible, reproducible, and easier to understand before students work with the physical Nexys A7 in the laboratory.

**Project motto:**

"Learn, Simulate, Understand — Before You Build on Hardware."