import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportEmployeeToPDF = async (emp) => {
  const doc = new jsPDF();
  
  // Load Logo
  const img = new Image();
  img.src = '/logo.png';
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    doc.addImage(img, 'PNG', 14, 12, 16, 20);
  } catch (err) {
    console.warn("Logo tidak dapat dimuat.");
  }

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CV. ASYA BISNIS INDONESIA', 34, 14);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('RETAIL & JASA LAYANAN ISI ULANG PRABAYAR', 34, 19);
  doc.text('Jl. Buni Sari No.238, Antapani Wetan, Kec. Antapani, Kota Bandung, Jawa Barat 40291', 34, 23);
  doc.text('+62 878-8786-5166', 34, 27);

  // Double line separator
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);
  doc.setLineWidth(0.2);
  doc.line(14, 33, 196, 33);

  const cell = (content, colSpan = 1, styles = {}) => ({ content, colSpan, styles });
  const cWidths = { 0: { cellWidth: 35 }, 1: { cellWidth: 30 }, 2: { cellWidth: 26 }, 3: { cellWidth: 30 }, 4: { cellWidth: 26 }, 5: { cellWidth: 35 } };

  // TITLE TABLE
  autoTable(doc, {
    startY: 40,
    theme: 'grid',
    head: [[cell('FORMULIR DATA KARYAWAN', 6, { halign: 'center', fontSize: 14, fillColor: [253, 203, 158], textColor: 0, fontStyle: 'bold' })]],
    body: [
      [cell('1. ISI DENGAN BENAR, KETIK DENGAN LENGKAP DAN JELAS.', 4), cell(`Tanggal : \${new Date().toLocaleDateString('id-ID')}`, 2)],
      [cell('2. JANGAN MENAMBAH ATAU MERUBAH BENTUK DAN ISI FORMULIR INI.', 6)]
    ],
    styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
    headStyles: { lineWidth: 0.2, lineColor: 0 },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 25 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30 }, 5: { cellWidth: 32 } }
  });

  // A. BIODATA
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    theme: 'grid',
    head: [[cell('A. BIODATA KARYAWAN', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
    body: [
      [cell('1. Nama Lengkap :', 1), cell(emp.name || '-', 5)],
      [
        cell('2. Jenis Kelamin :', 1), cell(emp.gender || '-', 1),
        cell('3. Tinggi Badan :', 1), cell(emp.height ? `\${emp.height} cm` : '-', 1),
        cell('4. Berat Badan :', 1), cell(emp.weight ? `\${emp.weight} kg` : '-', 1)
      ],
      [cell('5. Tempat & Tgl. Lahir :', 1), cell(`\${emp.birth_place || '-'}, \${emp.birth_date ? new Date(emp.birth_date).toLocaleDateString('id-ID') : '-'}`, 5)],
      [cell('6. Alamat Domisili :', 1), cell(emp.address_domicile || '-', 5)],
      [cell('7. Alamat KTP :', 1), cell(emp.address_ktp || '-', 5)],
      [cell('8. No. Telephone :', 1), cell(emp.phone || '-', 2), cell('No. Handphone :', 1), cell(emp.phone || '-', 2)],
      [cell('9. E-mail :', 1), cell(emp.email || '-', 5)],
      [
        cell('10. Agama :', 1), cell(emp.religion || '-', 2),
        cell('11. Gol. Darah :', 1), cell(emp.blood_type || '-', 2)
      ],
      [
        cell('12. Status Perkawinan :', 1), cell(emp.marital_status || '-', 2),
        cell('13. Tanggungan :', 1), cell(emp.dependents?.toString() || '0', 2)
      ]
    ],
    styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
    headStyles: { lineWidth: 0.2, lineColor: 0 },
    columnStyles: cWidths
  });

  // B. DATA KELUARGA & KONTAK
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    theme: 'grid',
    head: [[cell('B. DATA KELUARGA & KONTAK DARURAT', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
    body: [
      [cell('Nama Ayah :', 1), cell(emp.father_name || '-', 5)],
      [cell('Nama Ibu :', 1), cell(emp.mother_name || '-', 5)],
      [cell('Nama Pasangan :', 1), cell(emp.spouse_name || '-', 5)],
      [cell('Kontak Darurat 1 :', 1), cell(emp.emergency_contact_1 || '-', 5)],
      [cell('Kontak Darurat 2 :', 1), cell(emp.emergency_contact_2 || '-', 5)],
    ],
    styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
    headStyles: { lineWidth: 0.2, lineColor: 0 },
    columnStyles: cWidths
  });

  // C. PENDIDIKAN
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    theme: 'grid',
    head: [[cell('C. PENDIDIKAN', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
    body: [
      [cell('Pendidikan Terakhir :', 1), cell(emp.education_level || '-', 2), cell('Institusi :', 1), cell(emp.education_institution || '-', 2)],
      [cell('Jurusan :', 1), cell(emp.education_major || '-', 2), cell('Tahun Lulus :', 1), cell(emp.education_years || '-', 2)],
      [cell('Nilai / IPK :', 1), cell(emp.education_grade || '-', 5)],
    ],
    styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
    headStyles: { lineWidth: 0.2, lineColor: 0 },
    columnStyles: cWidths
  });

  // D. KESEHATAN & ADMINISTRASI
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    theme: 'grid',
    head: [[cell('D. KESEHATAN & ADMINISTRASI', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
    body: [
      [cell('Kondisi Fisik :', 1), cell(emp.physical_condition || '-', 2), cell('Tes Buta Warna :', 1), cell(emp.color_blind_test || '-', 2)],
      [cell('Riwayat Penyakit :', 1), cell(emp.health_history || '-', 2), cell('Alergi :', 1), cell(emp.allergies || '-', 2)],
      [
        cell('NPWP :', 1), cell(emp.npwp || '-', 2),
        cell('Ukuran Seragam :', 1), cell(emp.uniform_size || '-', 2)
      ],
      [
        cell('Nama Bank :', 1), cell(emp.bank_name || '-', 2),
        cell('No. Rekening :', 1), cell(emp.bank_account || '-', 2)
      ],
      [
        cell('BPJS Kesehatan :', 1), cell(emp.bpjs_health || '-', 2),
        cell('BPJS Naker :', 1), cell(emp.bpjs_employment || '-', 2)
      ],
    ],
    styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
    headStyles: { lineWidth: 0.2, lineColor: 0 },
    columnStyles: cWidths
  });

  // E. PENEMPATAN & KONTRAK
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    theme: 'grid',
    head: [[cell('E. PENEMPATAN & KONTRAK', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
    body: [
      [cell('Cabang Penempatan :', 1), cell(emp.branch_name || '-', 2), cell('Tipe Kontrak :', 1), cell(emp.contract_type || '-', 2)],
      [cell('Tanggal Diterima :', 1), cell(emp.start_date || emp.hire_date ? new Date(emp.start_date || emp.hire_date).toLocaleDateString('id-ID') : '-', 5)],
      [cell('Gaji Pokok :', 1), cell(emp.salary_offered ? `Rp \${Number(emp.salary_offered).toLocaleString('id-ID')}` : '-', 2), cell('Tunjangan :', 1), cell(emp.allowance ? `Rp \${Number(emp.allowance).toLocaleString('id-ID')}` : '-', 2)],
    ],
    styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
    headStyles: { lineWidth: 0.2, lineColor: 0 },
    columnStyles: cWidths
  });

  doc.save(`Data_Karyawan_\${emp.name.replace(/\\s+/g, '_')}.pdf`);
};
