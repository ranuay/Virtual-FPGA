\# PRD \& Technical Specification

\# ACSL Virtual FPGA Lab



\*\*Project Type:\*\* Web-based FPGA and Digital Systems Simulator  

\*\*Project Status:\*\* Initial Development  

\*\*Version:\*\* 1.0.0  

\*\*Reference Project:\*\* \[HDLBoard](https://github.com/rlangoy/HDLBoard)  

\*\*Documentation Reference:\*\* \[fpga.acsl.my.id](https://fpga.acsl.my.id)  

\*\*Target Hardware:\*\* Digilent Nexys A7  

\*\*Primary Language:\*\* VHDL, Verilog  

\*\*Simulation Engines:\*\* GHDL, Icarus Verilog



\---



\# 1. Project Overview



\## 1.1 Background



ACSL Virtual FPGA Lab merupakan platform simulasi praktikum FPGA berbasis web yang dikembangkan untuk mendukung kegiatan praktikum Advanced Computer System Laboratory (ACSL).



Project ini dikembangkan berdasarkan kebutuhan praktikum FPGA ACSL yang menggunakan Digilent Nexys A7 sebagai perangkat hardware utama.



Pengembangan menggunakan HDLBoard sebagai fondasi open-source, kemudian dimodifikasi dan diperluas agar sesuai dengan kebutuhan praktikum ACSL.



Inspirasi pengalaman pengguna berasal dari:

\- Cisco Packet Tracer: workspace interaktif dan simulasi perangkat.

\- PNETLab: lingkungan simulasi berbasis perangkat dan koneksi.

\- Wokwi: simulasi komponen elektronik dan microcontroller.

\- HDLBoard: simulasi FPGA berbasis VHDL dan Verilog.



Platform ini tidak bertujuan menjadi simulator elektronik universal. Fokus utamanya adalah menyediakan lingkungan praktikum virtual yang sesuai dengan kurikulum FPGA ACSL.



\## 1.2 Main Objectives



1\. Menyediakan virtual FPGA yang merepresentasikan Nexys A7.

2\. Menjalankan source code VHDL dan Verilog menggunakan simulator sesungguhnya.

3\. Mendukung source code dari modul praktikum ACSL tanpa perubahan yang tidak diperlukan.

4\. Menyediakan komponen input dan output virtual.

5\. Mendukung komunikasi UART dan virtual serial terminal.

6\. Menyediakan visualisasi hasil simulasi secara interaktif.

7\. Menjadi platform praktikum terpusat yang dapat dikembangkan untuk kebutuhan laboratorium.



\## 1.3 Development Philosophy



Prinsip utama pengembangan:



\- Reuse existing technology.

\- Hardware-accurate I/O behavior.

\- Simulation-first architecture.

\- Modular and extensible.

\- Curriculum-driven development.

\- Secure execution of user-submitted HDL code.



\*\*Jangan membangun ulang simulator HDL jika fungsinya sudah tersedia di HDLBoard.\*\*



\---



\# 2. Project Foundation



\## 2.1 Upstream Repository



Repository utama:



https://github.com/rlangoy/HDLBoard



Strategi pengembangan:



1\. Fork repository upstream.

2\. Clone fork ke development environment.

3\. Pelajari struktur frontend dan backend.

4\. Identifikasi pipeline GHDL dan Icarus Verilog.

5\. Identifikasi sistem board configuration.

6\. Identifikasi sistem input/output virtual.

7\. Modifikasi secara bertahap sesuai kebutuhan ACSL.



Jangan langsung melakukan redesign keseluruhan aplikasi.



\## 2.2 Licensing



HDLBoard menggunakan GPL-2.0.



Seluruh pengembangan turunan wajib memperhatikan ketentuan lisensi, termasuk kewajiban distribusi source code ketika mendistribusikan karya turunan dalam kondisi yang diatur GPL.



Pertahankan informasi copyright dan lisensi upstream.



Tambahkan dokumentasi kontribusi dan perubahan yang dibuat oleh ACSL.



\---



\# 3. Curriculum Requirements



Fitur dikembangkan berdasarkan kebutuhan modul praktikum ACSL.



\## 3.1 Curriculum Mapping



| Module | Subject | Virtual Components |

|---|---|---|

| Briefing | FPGA Introduction | Board Overview |

| Bab 1 | Basic VHDL | HDL Editor |

| Bab 2 | Data Types and Operators | HDL Editor |

| Bab 3 | RTL Analysis and Arithmetic | Simulator, Waveform |

| Bab 4 | UART, FTDI, Sensor, Pmod | LDR, UART, Serial Terminal |

| Bab 5 | Seven Segment and Push Button | 7-Segment, Buttons |

| Bab 6 | Finite State Machine | Traffic Light, FSM |

| Bab 7 | Arithmetic Logic Unit | ALU, Binary Input/Output |



Catatan: daftar tersebut merupakan pemetaan awal berdasarkan modul yang telah dibahas. Agent wajib memeriksa kembali seluruh materi resmi dan contoh source code sebelum menetapkan implementasi final.



\## 3.2 Bab 1 — Basic VHDL



Requirements:



\- VHDL editor.

\- Entity declaration.

\- Architecture declaration.

\- Library declaration.

\- Analyze source code.

\- Simulation.

\- Error reporting.



Expected output:



Mahasiswa dapat menulis kode VHDL sederhana dan melihat hasil simulasi.



\## 3.3 Bab 2 — Data Types and Operators



Requirements:



\- Integer.

\- Boolean.

\- STD\_LOGIC.

\- STD\_LOGIC\_VECTOR.

\- Array.

\- Logical operators.

\- Arithmetic operators.

\- Comparison operators.



Simulation harus mendukung berbagai tipe data dan operasi VHDL yang digunakan dalam modul.



\## 3.4 Bab 3 — RTL Analysis and Arithmetic



Requirements:



\- RTL analysis.

\- Arithmetic circuits.

\- Signal visualization.

\- Waveform viewer.

\- Simulation result inspection.



RTL schematic merupakan fitur tambahan yang perlu dievaluasi terpisah.



Jangan mengklaim bahwa GHDL dapat menggantikan seluruh proses synthesis dan implementation Vivado.



Jika diperlukan, integrasi toolchain FPGA seperti Vivado dapat dipertimbangkan pada tahap lanjutan.



\## 3.5 Bab 4 — UART, Sensor and Pmod



Bab ini memerlukan komponen virtual tambahan.



\### Virtual Sensor



Komponen pertama yang wajib didukung adalah LDR.



Requirements:



\- Adjustable light intensity atau mode terang/gelap.

\- Digital sensor input.

\- Connection to FPGA input.

\- Real-time input changes.

\- Sensor state visualization.



Perhatikan perbedaan antara sensor digital dan analog.



Jika rangkaian praktikum hanya menggunakan input digital LDR, simulator tidak perlu mengimplementasikan ADC analog yang tidak digunakan.



\### UART Simulation



Requirements:



\- UART TX.

\- UART RX.

\- Configurable baud rate.

\- Serial data transmission.

\- Serial data reception.

\- ASCII output.

\- Serial communication monitoring.



Default baud rate untuk contoh praktikum Bab 4: 9600 baud.



Konfigurasi harus tetap dapat disesuaikan dengan source code praktikum.



\### Virtual Serial Terminal



Buat terminal serial di dalam aplikasi.



Requirements:



\- Display received text.

\- Send text to simulated UART RX.

\- Clear terminal.

\- Connection status.

\- Baud rate configuration.

\- Timestamp opsional.

\- Auto-scroll.



Tampilan dan perilaku terminal terinspirasi dari PuTTY.



\### PuTTY Compatibility



Sediakan kemungkinan koneksi dengan PuTTY melalui serial bridge atau TCP connection.



Namun, fitur ini tidak boleh menjadi syarat untuk menjalankan praktikum.



Virtual terminal internal tetap menjadi pilihan utama.



\---



\# 4. Nexys A7 Virtual Board



\## 4.1 Board Requirements



Board virtual harus merepresentasikan komponen fisik Digilent Nexys A7 yang digunakan ACSL.



Referensi:



https://digilent.com/reference/programmable-logic/nexys-a7/start



Board harus memiliki komponen yang relevan dengan praktikum:



| Component | Requirement |

|---|---|

| Clock | 100 MHz source |

| Switch | 16 switches |

| LED | 16 LEDs |

| Push Button | 5 buttons |

| Seven Segment | 8 digits |

| Pmod | Virtual peripheral interface |

| Reset | Active-low reset |



Jumlah dan pemetaan komponen wajib diverifikasi terhadap varian Nexys A7 yang benar-benar digunakan lab.



\## 4.2 I/O Mapping



Jangan mengandalkan nama port dari board lain.



Buat konfigurasi khusus Nexys A7.



Mapping harus mengacu pada:



1\. Official Nexys A7 master XDC.

2\. Board reference manual.

3\. Source code praktikum ACSL.

4\. Hardware yang digunakan laboratorium.



Simpan konfigurasi board secara terpisah dari simulator.



Contoh konseptual:



```json

{

&#x20; "board": "acsl-nexys-a7",

&#x20; "clock": {

&#x20;   "frequency": 100000000,

&#x20;   "port": "CLK100MHZ"

&#x20; },

&#x20; "switches": {

&#x20;   "count": 16

&#x20; },

&#x20; "leds": {

&#x20;   "count": 16

&#x20; },

&#x20; "buttons": {

&#x20;   "count": 5

&#x20; },

&#x20; "sevenSegment": {

&#x20;   "digits": 8

&#x20; }

}

```



Objek di atas adalah contoh konfigurasi konseptual, bukan format konfigurasi HDLBoard yang sudah diverifikasi.



\## 4.3 Seven Segment



Requirements:



\- 8 individual digits.

\- Seven-segment display.

\- Decimal point.

\- Multiplexing support.

\- Active-low segment behavior.

\- Active-low digit selection.

\- Real-time display updates.



Simulator harus mampu membaca sinyal segment dan digit enable dari hasil simulasi.



Jangan hanya membuat display yang menerima angka secara langsung dari frontend.



Seven segment harus mengikuti output sinyal HDL.



\## 4.4 Push Button



Requirements:



\- Center.

\- Up.

\- Down.

\- Left.

\- Right.

\- Press/release state.

\- Correct signal polarity.

\- Reset behavior.



\## 4.5 LED and Switch



Requirements:



\- 16 independent switches.

\- 16 independent LEDs.

\- Interactive switches.

\- Real-time LED updates.

\- Correct bit indexing.

\- Correct signal polarity.



\---



\# 5. Bab 6 — FSM and Traffic Light



Buat visualisasi FSM dan traffic light.



Requirements:



\- Red light.

\- Yellow light.

\- Green light.

\- State transition visualization.

\- Clock-driven behavior.

\- Reset.

\- State indicator.

\- Optional countdown display.



Traffic light harus mengikuti output simulasi HDL, bukan sekadar animasi frontend.



Jika state berubah dalam simulator, visualisasi harus ikut berubah.



\---



\# 6. Bab 7 — Arithmetic Logic Unit



Buat ALU visualizer untuk mendukung praktikum.



Komponen yang dibutuhkan berdasarkan materi:



\- Half Adder.

\- Full Adder.

\- 3-bit Adder.

\- Full Subtractor.

\- 3-bit Subtractor.

\- 3-bit Multiplier.

\- 3-bit Comparator.

\- ALU.



Requirements:



\- Binary input controls.

\- Operation selection.

\- Result visualization.

\- Carry output.

\- Borrow output jika relevan.

\- Comparison result.

\- Real-time signal updates.



Semua output harus berasal dari hasil simulasi HDL.



Frontend hanya bertugas menampilkan dan mengirimkan input.



\---



\# 7. System Architecture



\## 7.1 High-Level Architecture



```text

&#x20;                ACSL VIRTUAL FPGA LAB

&#x20;                          |

&#x20;            +-------------+-------------+

&#x20;            |                           |

&#x20;       Frontend                     Backend

&#x20;            |                           |

&#x20;   +--------+---------+         +-------+--------+

&#x20;   |        |         |         |       |        |

&#x20; Editor   Virtual   Waveform  Project  Simulation

&#x20;          Board              Manager    Manager

&#x20;   |        |                   |         |

&#x20;   +--------+-------------------+---------+

&#x20;                            |

&#x20;                     Simulation Engine

&#x20;                            |

&#x20;                 +----------+----------+

&#x20;                 |                     |

&#x20;                GHDL              Icarus Verilog

&#x20;                 |                     |

&#x20;              VHDL Simulation       Verilog Simulation

&#x20;                 |                     |

&#x20;                 +----------+----------+

&#x20;                            |

&#x20;                      Signal Output

&#x20;                            |

&#x20;               Virtual Board / Terminal

```



Diagram tersebut merupakan target arsitektur logis. Implementasi harus disesuaikan dengan arsitektur aktual HDLBoard setelah audit.



\## 7.2 Architecture Principles



\- Frontend tidak menjalankan simulator secara langsung.

\- Backend bertanggung jawab terhadap proses simulasi.

\- Setiap project memiliki konfigurasi sendiri.

\- Setiap simulasi berjalan dalam isolated environment.

\- Input dan output board harus mempunyai interface yang konsisten.

\- Simulator harus dapat dikembangkan tanpa mengubah seluruh frontend.



\## 7.3 Simulation Lifecycle



Target lifecycle:



```text

User writes HDL

&#x20;     |

&#x20;     v

Save Project

&#x20;     |

&#x20;     v

Validate Files

&#x20;     |

&#x20;     v

Analyze HDL

&#x20;     |

&#x20;     v

Elaborate Design

&#x20;     |

&#x20;     v

Start Simulation

&#x20;     |

&#x20;     v

Process Input Signals

&#x20;     |

&#x20;     v

Read Output Signals

&#x20;     |

&#x20;     v

Update Virtual Board

&#x20;     |

&#x20;     v

Display Simulation Result

```



Jangan menganggap Analyze, Elaborate, dan Run sebagai satu proses yang sama.



Error pada setiap tahap harus ditampilkan secara terpisah.



\---



\# 8. HDL Compatibility



\## 8.1 GHDL



VHDL simulator menggunakan GHDL.



Requirements:



\- VHDL-93 compatibility.

\- VHDL-2008 compatibility.

\- Standard IEEE libraries.

\- Synopsys compatibility where required.

\- Multi-file compilation.

\- Dependency ordering.

\- Error reporting.

\- Simulation control.



\### Important: Synopsys Compatibility



Contoh kode dari praktikum ACSL menggunakan:



```vhdl

use IEEE.std\_logic\_arith.ALL;

use IEEE.std\_logic\_unsigned.ALL;

```



GHDL mengeluarkan error:



```text

use of synopsys package "std\_logic\_arith"

needs the -fsynopsys option

```



Perbaiki konfigurasi GHDL agar kompatibel.



Contoh command:



```bash

ghdl -a --std=08 -fsynopsys source.vhdl

```



Agent wajib mengaudit seluruh command pipeline, termasuk analyze, elaboration, dan run.



Jangan hanya menambahkan flag pada satu command.



Jangan otomatis mengubah source code praktikum.



\### Important Compatibility Rules



\- Pertahankan urutan dependency.

\- Pastikan package dianalisis sebelum entity yang menggunakannya.

\- Tangani library yang diperlukan.

\- Hindari konflik antara konfigurasi VHDL project.

\- Pertahankan error asli dari GHDL agar mudah di-debug.



\## 8.2 Icarus Verilog



Requirements:



\- Verilog simulation.

\- Compilation.

\- Elaboration.

\- Runtime simulation.

\- Error reporting.

\- Signal output integration.



Pastikan penggunaan Icarus tidak mengganggu pipeline GHDL.



\---



\# 9. Virtual Board Simulation Interface



Buat interface yang menghubungkan simulator dengan komponen virtual.



Konsep:



```text

Simulation Engine

&#x20;      |

&#x20;      v

Signal Adapter

&#x20;      |

&#x20;      +---- Input Signals

&#x20;      |         |

&#x20;      |      Virtual Switch

&#x20;      |      Virtual Button

&#x20;      |      Virtual Sensor

&#x20;      |

&#x20;      +---- Output Signals

&#x20;                |

&#x20;             Virtual LED

&#x20;             Seven Segment

&#x20;             Traffic Light

&#x20;             UART Terminal

```



Requirements:



\- Bidirectional signal mapping.

\- Input state management.

\- Output state management.

\- Signal update synchronization.

\- Simulation clock management.

\- Error handling.



Frontend tidak boleh menjadi sumber kebenaran bagi output HDL.



Semua output harus berasal dari simulator.



\---



\# 10. User Interface and Experience



\## 10.1 Main Workspace



Target interface:



```text

+------------------------------------------------------+

| ACSL Virtual FPGA                    Project / Run    |

+----------------+-------------------------------------+

|                |                                     |

| Project Files  |         Virtual Nexys A7            |

|                |                                     |

| source.vhdl    |       \[ Switches ] \[ LEDs ]          |

| testbench.vhdl |                                     |

|                |       \[ Seven Segment ]              |

|                |                                     |

+----------------+-------------------------------------+

| HDL Editor                                           |

|                                                      |

|  VHDL / Verilog source code                          |

|                                                      |

+------------------------------------------------------+

| Console | Waveform | Serial Terminal | Problems      |

+------------------------------------------------------+

```



Ini adalah konsep layout, bukan keharusan meniru tampilan HDLBoard secara persis.



\## 10.2 Main Interface Components



\- Project explorer.

\- HDL editor.

\- Virtual board.

\- Simulation controls.

\- Console.

\- Problems panel.

\- Waveform viewer.

\- Serial terminal.



\## 10.3 Simulation Controls



\- Analyze.

\- Run.

\- Stop.

\- Reset.

\- Restart.

\- Clear output.



Jika HDLBoard sudah menyediakan fungsi serupa, gunakan implementasi yang tersedia dan sesuaikan seperlunya.



\## 10.4 UX Principles



\- Clean interface.

\- Professional laboratory appearance.

\- Responsive layout.

\- Dark and light theme jika sesuai dengan kemampuan upstream.

\- Clear error messages.

\- No unnecessary animations.

\- Keyboard-friendly editor.

\- Suitable for desktop and laptop.



Prioritaskan desktop karena praktikum membutuhkan editor dan virtual board secara bersamaan.



\---



\# 11. Technology Stack



Gunakan stack aktual HDLBoard sebagai prioritas.



Jangan mengganti framework tanpa alasan teknis.



Kandidat teknologi tambahan:



| Requirement | Technology |

|---|---|

| VHDL | GHDL |

| Verilog | Icarus Verilog |

| Code Editor | Existing HDLBoard editor |

| Waveform | Existing HDLBoard waveform implementation |

| Serial Terminal | xterm.js or equivalent |

| Communication | WebSocket |

| Sensor Simulation | Custom peripheral adapter |

| Process Isolation | Container or equivalent sandbox |

| Frontend | Existing HDLBoard framework |



Teknologi tambahan hanya boleh digunakan jika memang dibutuhkan.



\---



\# 12. Security and Execution Isolation



Simulator akan menerima source code dari mahasiswa.



Karena itu, security merupakan requirement utama.



Requirements:



\- Isolated simulation process.

\- Restricted filesystem access.

\- No unrestricted shell execution.

\- CPU limits.

\- Memory limits.

\- Execution timeout.

\- Temporary project directories.

\- Safe cleanup.

\- Restricted network access.

\- Controlled process termination.



Jangan menjalankan source code pengguna dengan akses penuh ke host server.



Jangan menganggap menjalankan GHDL atau Icarus dalam subprocess otomatis membuat eksekusi aman.



\---



\# 13. Development Roadmap



\## Phase 0 — Repository Audit



Priority: Critical.



Tasks:



1\. Fork HDLBoard.

2\. Clone repository.

3\. Read project documentation.

4\. Inspect repository structure.

5\. Identify frontend architecture.

6\. Identify backend architecture.

7\. Identify GHDL execution pipeline.

8\. Identify Icarus execution pipeline.

9\. Inspect board configuration.

10\. Inspect signal communication.

11\. Inspect existing waveform implementation.

12\. Identify upstream limitations.



Deliverables:



\- Repository architecture report.

\- Existing feature inventory.

\- Modification plan.

\- Technical risk assessment.



Do not start large-scale implementation during this phase.



\## Phase 1 — ACSL Foundation



Priority: Critical.



Tasks:



1\. Configure ACSL development environment.

2\. Fix GHDL Synopsys compatibility.

3\. Validate VHDL-2008.

4\. Validate multi-file project support.

5\. Test existing Icarus functionality.

6\. Establish regression tests.

7\. Document simulator commands.



Acceptance Criteria:



\- Basic VHDL project works.

\- Existing VHDL project remains functional.

\- ACSL code using `std\_logic\_arith` can be analyzed.

\- ACSL code using `std\_logic\_unsigned` can be analyzed.

\- No regression in existing simulator functionality.



\## Phase 2 — Nexys A7 Board



Priority: Critical.



Tasks:



1\. Create ACSL Nexys A7 board profile.

2\. Verify board pin and signal mapping.

3\. Implement switches.

4\. Implement LEDs.

5\. Implement push buttons.

6\. Implement clock.

7\. Implement reset.

8\. Implement seven segment.

9\. Test output polarity.



Acceptance Criteria:



\- All virtual board components respond correctly.

\- Signal mapping matches the documented hardware.

\- Seven-segment output is correct.

\- Push button behavior matches hardware.

\- No hardcoded mappings scattered throughout frontend code.



\## Phase 3 — Bab 1–3 Simulation



Priority: High.



Tasks:



1\. Test basic VHDL.

2\. Test data types.

3\. Test operators.

4\. Test arrays.

5\. Test arithmetic.

6\. Test waveform.

7\. Test RTL inspection capabilities.



Acceptance Criteria:



\- Students can follow the first three practical modules.

\- Source code can be analyzed and simulated.

\- Errors are understandable.

\- Waveform can be inspected.



\## Phase 4 — Bab 5 and Bab 6 Components



Priority: High.



Tasks:



1\. Seven-segment integration.

2\. Push button integration.

3\. Up/down counter test.

4\. Binary-to-BCD test.

5\. FSM state visualization.

6\. Traffic light visualization.

7\. Clock and reset integration.



Acceptance Criteria:



\- Seven-segment exercises work.

\- Push button exercises work.

\- FSM output is synchronized with simulation.

\- Traffic light reflects actual HDL signals.



\## Phase 5 — Bab 4 UART and Sensor



Priority: High.



Tasks:



1\. Implement virtual LDR.

2\. Implement Pmod abstraction.

3\. Implement UART signal monitoring.

4\. Implement virtual serial terminal.

5\. Implement UART RX input.

6\. Implement UART TX output.

7\. Test 9600 baud.

8\. Test ASCII output.

9\. Investigate external PuTTY integration.



Acceptance Criteria:



\- LDR input can be changed interactively.

\- FPGA receives the correct sensor state.

\- UART output is displayed in the virtual terminal.

\- Terminal supports the communication flow required by the module.

\- PuTTY integration is optional.



\## Phase 6 — Bab 7 ALU



Priority: Medium.



Tasks:



1\. Half Adder.

2\. Full Adder.

3\. 3-bit Adder.

4\. Full Subtractor.

5\. 3-bit Subtractor.

6\. 3-bit Multiplier.

7\. 3-bit Comparator.

8\. ALU visualization.



Acceptance Criteria:



\- Inputs can be changed interactively.

\- Outputs match the HDL simulation.

\- Carry and comparison signals are visible.

\- Arithmetic results can be validated.



\## Phase 7 — ACSL Deployment



Priority: Medium.



Tasks:



1\. Prepare production configuration.

2\. Configure reverse proxy.

3\. Configure simulation isolation.

4\. Configure resource limits.

5\. Configure logs.

6\. Configure cleanup.

7\. Deploy to ACSL infrastructure.

8\. Run integration tests.



Acceptance Criteria:



\- Platform is accessible through the intended ACSL domain.

\- Multiple users can run independent sessions.

\- Simulation processes are isolated.

\- Failed sessions can be terminated and cleaned up.



\---



\# 14. Testing Strategy



Setiap fitur harus memiliki test case.



\## 14.1 HDL Tests



\- Basic VHDL entity.

\- Multiple architectures.

\- VHDL-2008.

\- Synopsys packages.

\- Multiple source files.

\- Invalid source code.

\- Verilog basic simulation.

\- Testbench simulation.



\## 14.2 Nexys A7 Tests



\- Switch to LED.

\- Push button to LED.

\- Reset.

\- Clock.

\- Seven-segment digit selection.

\- Seven-segment segment output.

\- Multiplexing.



\## 14.3 UART Tests



\- UART transmission.

\- UART reception.

\- Baud rate 9600.

\- ASCII output.

\- Serial terminal synchronization.

\- Invalid communication settings.



\## 14.4 Regression Tests



Setiap perubahan pada simulator harus menjalankan regression tests agar fitur upstream tidak rusak.



\---



\# 15. Out of Scope



Fitur berikut tidak menjadi prioritas versi pertama:



\- General-purpose Arduino simulator.

\- ESP32 simulator.

\- Full microcontroller emulator.

\- Full PCB design environment.

\- General electronics SPICE simulation.

\- Full Vivado replacement.

\- Physical FPGA programming through browser.

\- Multi-board network simulation.

\- Advanced analog electronics simulation.



Fitur tersebut hanya dapat dipertimbangkan jika ada kebutuhan nyata dalam kurikulum ACSL.



\---



\# 16. Definition of Done



Project dianggap mencapai MVP apabila:



\- \[ ] HDLBoard berhasil di-fork dan dijalankan.

\- \[ ] GHDL Synopsys compatibility berfungsi.

\- \[ ] VHDL-2008 berfungsi.

\- \[ ] Icarus Verilog tetap berfungsi.

\- \[ ] Nexys A7 virtual board tersedia.

\- \[ ] Switch dan LED berfungsi.

\- \[ ] Push button berfungsi.

\- \[ ] Seven segment berfungsi.

\- \[ ] Bab 1–3 dapat disimulasikan.

\- \[ ] Bab 4 UART dan LDR dapat disimulasikan.

\- \[ ] Bab 5 seven segment dapat disimulasikan.

\- \[ ] Bab 6 FSM dan traffic light dapat disimulasikan.

\- \[ ] Bab 7 ALU dapat disimulasikan.

\- \[ ] Waveform dapat diperiksa.

\- \[ ] Simulation process memiliki isolation dan resource limits.

\- \[ ] Dokumentasi penggunaan tersedia.



\---



\# 17. Important Development Rules for AI Agents



Agent harus mengikuti aturan berikut:



1\. Audit repository sebelum mengubah kode.

2\. Jangan mengasumsikan struktur HDLBoard.

3\. Jangan mengganti teknologi existing tanpa alasan.

4\. Jangan membuat simulator HDL sendiri.

5\. Jangan mengubah source code praktikum untuk menghindari masalah simulator.

6\. Jangan membuat output virtual yang tidak berasal dari hasil simulasi.

7\. Jangan mengasumsikan pin mapping Nexys A7.

8\. Verifikasi semua mapping terhadap official XDC dan hardware lab.

9\. Implementasikan fitur secara bertahap.

10\. Jalankan regression tests setelah perubahan.

11\. Dokumentasikan setiap perubahan.

12\. Jangan mengimplementasikan fitur di luar scope tanpa persetujuan.

13\. Jangan menghapus fitur upstream yang masih berguna.

14\. Jangan menampilkan fitur yang sebenarnya belum berfungsi.

15\. Prioritaskan akurasi simulasi dibandingkan tampilan.



\---



\# 18. Initial AI Agent Prompt



Gunakan prompt berikut ketika memulai project di OMP.



\## TASK: Initialize ACSL Virtual FPGA Lab Development



You are acting as a Senior FPGA Software Engineer, Full-Stack Engineer, and Software Architect.



We are developing ACSL Virtual FPGA Lab, an educational FPGA simulation platform based on the open-source HDLBoard repository.



The project will be developed as a fork of:



https://github.com/rlangoy/HDLBoard



The target hardware is Digilent Nexys A7.



The official practical modules are documented at:



https://fpga.acsl.my.id



Your first responsibility is NOT to implement the entire platform.



Your first responsibility is to understand the existing repository and produce a reliable development plan.



\### Step 1 — Repository Audit



Inspect:



\- Repository structure.

\- Frontend architecture.

\- Backend architecture.

\- Existing board configuration.

\- GHDL integration.

\- Icarus Verilog integration.

\- HDL compilation pipeline.

\- Simulation lifecycle.

\- Waveform implementation.

\- Input/output signal communication.

\- Existing security limitations.



Do not assume technologies or implementation details without inspecting the source code.



\### Step 2 — Curriculum Analysis



Analyze the official ACSL documentation.



Identify:



\- Practical modules.

\- HDL source code.

\- Required hardware components.

\- Input/output signals.

\- UART configuration.

\- Sensor requirements.

\- Seven-segment requirements.

\- FSM requirements.

\- ALU requirements.



Create a curriculum-to-feature mapping.



\### Step 3 — Compatibility Analysis



Investigate the following error:



```text

use of synopsys package "std\_logic\_arith"

needs the -fsynopsys option



use of synopsys package "std\_logic\_unsigned"

needs the -fsynopsys option

```



Determine exactly where GHDL arguments are constructed.



Propose a solution that allows ACSL practical source code to work without unnecessary source modifications.



Preserve existing VHDL functionality.



\### Step 4 — Architecture Proposal



Design a modular architecture for:



\- HDL Editor.

\- Simulation Engine.

\- Nexys A7 Virtual Board.

\- Virtual I/O.

\- UART Communication.

\- LDR Sensor.

\- Virtual Serial Terminal.

\- Waveform Viewer.

\- FSM Visualization.

\- ALU Visualization.



Reuse existing HDLBoard components wherever possible.



\### Step 5 — Development Plan



Create:



```text

docs/

├── PRD.md

├── ARCHITECTURE.md

├── CURRICULUM\_MAPPING.md

├── BOARD\_SPECIFICATION.md

├── SIMULATION\_ENGINE.md

├── DEVELOPMENT\_ROADMAP.md

└── TESTING\_STRATEGY.md

```



Do not overwrite existing documentation without inspecting it first.



\### Step 6 — Report



Provide:



1\. Existing architecture summary.

2\. Existing feature inventory.

3\. Technical limitations.

4\. Required modifications.

5\. Dependency requirements.

6\. Proposed architecture.

7\. Development roadmap.

8\. Risks and recommendations.



\### Important Restrictions



\- Do not start large-scale implementation.

\- Do not rewrite the project.

\- Do not replace GHDL or Icarus.

\- Do not assume Nexys A7 pin mappings.

\- Do not modify official practical source code.

\- Do not claim a feature works without testing it.



First complete the audit and technical specification.



Wait for approval before starting major implementation.



\---



\# 19. Final Project Vision



ACSL Virtual FPGA Lab should become a unified virtual environment where students can:



1\. Open a practical module.

2\. Write or paste HDL source code.

3\. Configure the virtual FPGA.

4\. Interact with virtual hardware.

5\. Run actual HDL simulation.

6\. Observe hardware outputs.

7\. Inspect waveform and serial communication.

8\. Understand the behavior of their digital circuits.



The goal is not to replace physical FPGA hardware entirely.



The goal is to make FPGA practical learning more accessible, reproducible, and easier to understand before students work with the physical Nexys A7 in the laboratory.



\*\*Project motto:\*\*



"Learn, Simulate, Understand — Before You Build on Hardware."



