const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'EmployeeData.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Imports
const imports = `
import { employeeApi, branchApi } from '../services/api';
import { exportEmployeeToPDF } from '../utils/pdfExport';
import EmployeeFormModal from '../components/Employee/EmployeeFormModal';
import EmployeeCardModal from '../components/Employee/EmployeeCardModal';
`;
content = content.replace("import { jsPDF } from 'jspdf';\nimport autoTable from 'jspdf-autotable';", imports);
content = content.replace("import API_BASE from '../config';\n", "");

// 2. Remove FormSection, Field, inp definitions from EmployeeData.jsx
const formSectionMatch = content.indexOf('// ─── Reusable Form Field Components ───────────────────────────────────────────');
const employeeDataMatch = content.indexOf('function EmployeeData({ onSelectCandidate, setView }) {');
if (formSectionMatch !== -1 && employeeDataMatch !== -1) {
  content = content.substring(0, formSectionMatch) + content.substring(employeeDataMatch);
}

// 3. Replace fetch API calls
content = content.replace(/const res = await fetch\(`\$\{API_BASE\}\/branches`\);\s*const data = await res\.json\(\);/g, "const data = await branchApi.getAll();");

const empFetchStr = `const res = await fetch(\`\$\{API_BASE\}\/employees?\$\{queryParams.toString()\}\`);
      const data = await res.json();`;
content = content.replace(empFetchStr, `const data = await employeeApi.getAll(Object.fromEntries(queryParams.entries()));`);

const empSubmitStr = `const url = editEmployeeId ? \`\$\{API_BASE\}\/employees/\$\{editEmployeeId\}\` : \`\$\{API_BASE\}\/employees/manual\`;
      const method = editEmployeeId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          branch_id: addForm.branch_id ? parseInt(addForm.branch_id) : null,
          salary_offered: addForm.salary_offered ? parseFloat(addForm.salary_offered) : 0,
          allowance: addForm.allowance ? parseFloat(addForm.allowance) : 0,
          dependents: addForm.dependents ? parseInt(addForm.dependents) : 0,
          height: addForm.height ? parseInt(addForm.height) : null,
          weight: addForm.weight ? parseInt(addForm.weight) : null,
        })
      });
      const data = await res.json();`;

const newEmpSubmitStr = `const payload = {
          ...addForm,
          branch_id: addForm.branch_id ? parseInt(addForm.branch_id) : null,
          salary_offered: addForm.salary_offered ? parseFloat(addForm.salary_offered) : 0,
          allowance: addForm.allowance ? parseFloat(addForm.allowance) : 0,
          dependents: addForm.dependents ? parseInt(addForm.dependents) : 0,
          height: addForm.height ? parseInt(addForm.height) : null,
          weight: addForm.weight ? parseInt(addForm.weight) : null,
      };
      let data;
      if (editEmployeeId) {
        data = await employeeApi.update(editEmployeeId, payload);
      } else {
        data = await employeeApi.addManual(payload);
      }`;
content = content.replace(empSubmitStr, newEmpSubmitStr);

// 4. Remove inline exportEmployeeToPDF function
const pdfStart = content.indexOf('const exportEmployeeToPDF = async (emp, e) => {');
const pdfEnd = content.indexOf('};\n\n  const totalEmployees') + 2;
if (pdfStart !== -1 && pdfEnd !== -1) {
  content = content.substring(0, pdfStart) + `const handleExportPDF = (emp, e) => { e.stopPropagation(); exportEmployeeToPDF(emp); };\n` + content.substring(pdfEnd);
}
content = content.replace(/exportEmployeeToPDF\(emp, e\)/g, "handleExportPDF(emp, e)");

// 5. Replace inline Modals with components
// Find start of modal
const addModalStart = content.indexOf('{/* ═══════════════════════════════════════════════════════\n          MODAL: TAMBAH KARYAWAN LAMA');
const addModalEnd = content.indexOf('{/* Employee Detail Card Modal */}');
if (addModalStart !== -1 && addModalEnd !== -1) {
  const newAddModalStr = `{showAddModal && (
        <EmployeeFormModal 
          editEmployeeId={editEmployeeId} 
          addError={addError} 
          submitting={submitting} 
          handleAddManual={handleAddManual} 
          addForm={addForm} 
          setAddForm={setAddForm} 
          setShowAddModal={setShowAddModal} 
          setEditEmployeeId={setEditEmployeeId} 
          setAddError={setAddError} 
          emptyForm={emptyForm} 
          branches={branches} 
        />
      )}\n\n      `;
  content = content.substring(0, addModalStart) + newAddModalStr + content.substring(addModalEnd);
}

// Find EmployeeDetail card
const cardModalStart = content.indexOf('{/* Employee Detail Card Modal */}');
const cardModalEnd = content.lastIndexOf('</div>\n    </div>\n  );\n}');
if (cardModalStart !== -1 && cardModalEnd !== -1) {
  const newCardModalStr = `{selectedEmployeeCard && (
        <EmployeeCardModal emp={selectedEmployeeCard} onClose={() => setSelectedEmployeeCard(null)} />
      )}\n    `;
  content = content.substring(0, cardModalStart) + newCardModalStr + content.substring(cardModalEnd);
}

fs.writeFileSync(targetFile, content);
console.log('Refactored EmployeeData.jsx');
