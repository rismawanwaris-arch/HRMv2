const { app, request, dbReady, login, authed } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcTHP,
  calcBPJS,
  calcPPh21TER,
  calcOvertimePay,
  calcTHR,
  haversineMeters,
} = require('../utils/payrollCalc');

function todayLocalStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDaysStr(baseStr, days) {
  const dt = new Date(`${baseStr}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

let masterApi;
let financeApi;
let staffApi;

test.before(async () => {
  await dbReady();
  const masterToken = await login();
  masterApi = authed(masterToken);

  const suffix = Date.now();
  const finUser = `sf_fin_${suffix}`;
  const stfUser = `sf_stf_${suffix}`;

  await masterApi.post('/api/admins').send({ username: finUser, password: 'QaPassword123!', role: 'finance' });
  await masterApi.post('/api/admins').send({ username: stfUser, password: 'QaPassword123!', role: 'staff' });

  financeApi = authed(await login(finUser, 'QaPassword123!'));
  staffApi = authed(await login(stfUser, 'QaPassword123!'));
});

test('Unit: SunFish HR statutory & payroll calculations (BPJS, PPh 21 TER, Overtime, THR, Geofence, THP)', () => {
  // BPJS within caps & exceeding caps
  const bpjs8m = calcBPJS(8000000, {});
  assert.equal(bpjs8m.bpjs_kes_emp, 80000);       // 1% of 8M
  assert.equal(bpjs8m.bpjs_kes_company, 320000);  // 4% of 8M
  assert.equal(bpjs8m.bpjs_jht_emp, 160000);      // 2% of 8M
  assert.equal(bpjs8m.bpjs_jp_emp, 80000);        // 1% of 8M
  assert.equal(bpjs8m.bpjs_tk_emp, 240000);

  const bpjs15m = calcBPJS(15000000, { bpjs_kes_cap: '12000000', bpjs_jp_cap: '10547400' });
  assert.equal(bpjs15m.bpjs_kes_emp, 120000);     // capped at 12M * 1%
  assert.equal(bpjs15m.bpjs_jp_emp, 105474);      // capped at 10,547,400 * 1%

  // PPh 21 TER Categories A, B, C
  assert.equal(calcPPh21TER(5000000, 'TK/0').rate, 0);
  const pphA10 = calcPPh21TER(10000000, 'TK/0');
  assert.equal(pphA10.category, 'A');
  assert.equal(pphA10.rate, 2);
  assert.equal(pphA10.amount, 200000);

  const pphB = calcPPh21TER(9500000, 'K/1');
  assert.equal(pphB.category, 'B');
  assert.equal(pphB.rate, 1.5);
  assert.equal(pphB.amount, 142500);

  const pphC = calcPPh21TER(9000000, 'K/3');
  assert.equal(pphC.category, 'C');
  assert.equal(pphC.rate, 1.25);
  assert.equal(pphC.amount, 112500);

  // Overtime PP 35/2021
  assert.equal(calcOvertimePay(1730000, 3, 'weekday', 173), 55000); // 10000 * (1.5 + 2 + 2)
  assert.equal(calcOvertimePay(1730000, 9, 'holiday', 173), 210000); // 10000 * (7*2 + 1*3 + 1*4)

  // THR Permenaker 6/2016
  assert.equal(calcTHR(6000000, '2026-10-20', '2026-11-05').amount, 0);        // < 1 month
  assert.equal(calcTHR(6000000, '2026-01-01', '2026-07-01').amount, 3000000);  // 6 months -> 50%
  assert.equal(calcTHR(6000000, '2024-01-01', '2026-01-01').amount, 6000000);  // >= 12 months -> 100%

  // Haversine Geofence
  assert.equal(haversineMeters(-6.2, 106.8, -6.2, 106.8), 0);
  const near = haversineMeters(-6.2000, 106.8166, -6.2004, 106.8167);
  assert.ok(near > 20 && near < 100);

  // Updated calcTHP includes all SunFish earnings & deductions
  const thp = calcTHP({
    salary: 5000000,
    allowance: 500000,
    overtime_pay: 200000,
    reimbursement_pay: 100000,
    thr_pay: 1000000,
    deduction_loan: 300000,
    bpjs_kes_emp: 55000,
    bpjs_tk_emp: 165000,
    pph21_deduction: 95000,
  });
  assert.equal(thp, 6800000 - 615000);
});

test('Contract lifecycle: alerts, renewal, permanent conversion & employee_history audit', async () => {
  const bRes = await masterApi.post('/api/branches').send({
    code: 'SF-C1',
    name: 'Cabang Kontrak QA',
    location_type: 'Konter',
    latitude: -6.2,
    longitude: 106.816666,
    geofence_radius_m: 150,
  });
  assert.equal(bRes.status, 200);
  const branchId = bRes.body.data.id;

  const soonDate = addDaysStr(todayLocalStr(), 5);
  const empRes = await financeApi.post('/api/staff').send({
    name: 'Karyawan Kontrak QA',
    branch_id: branchId,
    employee_type: 'Frontliner',
    position: 'Kasir',
    contract_type: 'PKWT',
    contract_start: '2026-01-01',
    contract_end: soonDate,
    hire_date: '2026-01-01',
    salary: 3500000,
    allowance: 250000,
  });
  assert.equal(empRes.status, 200);
  const empId = empRes.body.employeeId;

  // Contract alerts should include this employee
  const alertRes = await financeApi.get('/api/staff/contract-alerts?days=30');
  assert.equal(alertRes.status, 200);
  const foundAlert = alertRes.body.data.find((a) => a.id === empId);
  assert.ok(foundAlert, 'Employee near contract expiry must appear in alerts');
  assert.equal(foundAlert.alert_type, 'contract');
  assert.ok(foundAlert.days_remaining <= 5);

  // Edit position & salary -> automatic employee_history rows
  const detail = await financeApi.get(`/api/staff/${empId}`);
  const updRes = await financeApi.put(`/api/staff/${empId}`).send({
    ...detail.body.data,
    position: 'Kasir Senior',
    salary: 3800000,
  });
  assert.equal(updRes.status, 200);

  const hist1 = await financeApi.get(`/api/staff/${empId}/history`);
  assert.equal(hist1.status, 200);
  assert.ok(hist1.body.data.some((h) => h.event_type === 'Perubahan Jabatan'));
  assert.ok(hist1.body.data.some((h) => h.event_type === 'Penyesuaian Gaji'));

  // Renew contract
  const nextEnd = addDaysStr(todayLocalStr(), 365);
  const renewRes = await financeApi.post(`/api/staff/${empId}/renew-contract`).send({
    action: 'renew',
    contract_type: 'PKWT',
    contract_start: todayLocalStr(),
    contract_end: nextEnd,
    notes: 'Perpanjangan 1 tahun',
  });
  assert.equal(renewRes.status, 200);
  assert.equal(renewRes.body.data.contract_end, nextEnd);

  // Convert to permanent PKWTT
  const permRes = await financeApi.post(`/api/staff/${empId}/renew-contract`).send({
    action: 'permanent',
    contract_start: todayLocalStr(),
    notes: 'Diangkat karyawan tetap',
  });
  assert.equal(permRes.status, 200);
  assert.equal(permRes.body.data.contract_type, 'PKWTT');
  assert.equal(permRes.body.data.contract_end, null);

  const hist2 = await financeApi.get(`/api/staff/${empId}/history`);
  assert.ok(hist2.body.data.some((h) => h.event_type === 'Perpanjangan Kontrak'));
  assert.ok(hist2.body.data.some((h) => h.event_type === 'Pengangkatan Tetap'));
});

test('Leave workflow: quota, overlap rejection, approve auto-syncs daily_attendance & cancel rollback', async () => {
  const empRes = await financeApi.post('/api/staff').send({
    name: 'Karyawan Cuti QA',
    employee_type: 'Staff',
    position: 'Admin',
    salary: 5000000,
    hire_date: '2025-01-01',
  });
  const empId = empRes.body.employeeId;

  const typesRes = await staffApi.get('/api/leaves/types');
  assert.equal(typesRes.status, 200);
  const annualType = typesRes.body.data.find((t) => t.code === 'ANNUAL');
  const unpaidType = typesRes.body.data.find((t) => t.code === 'UNPAID');
  assert.ok(annualType && unpaidType);

  const initRes = await financeApi.post('/api/leaves/balances/init-year').send({ year: 2026 });
  assert.equal(initRes.status, 200);

  // Staff submits 2-day paid annual leave in Nov 2026 period (2026-11-10..11)
  const req1 = await staffApi.post('/api/leaves/requests').send({
    employee_id: empId,
    leave_type_id: annualType.id,
    start_date: '2026-11-10',
    end_date: '2026-11-11',
    reason: 'Acara keluarga',
  });
  assert.equal(req1.status, 201);
  assert.equal(req1.body.data.total_days, 2);
  const req1Id = req1.body.data.id;

  // Overlapping request must fail
  const overlap = await staffApi.post('/api/leaves/requests').send({
    employee_id: empId,
    leave_type_id: annualType.id,
    start_date: '2026-11-11',
    end_date: '2026-11-12',
  });
  assert.equal(overlap.status, 400);

  // Staff cannot approve
  const forbiddenApprove = await staffApi.put(`/api/leaves/requests/${req1Id}/approve`).send({});
  assert.equal(forbiddenApprove.status, 403);

  // Finance approves -> auto-sync daily_attendance as 'Cuti', used = 2, absent deduction = 0
  const appRes = await financeApi.put(`/api/leaves/requests/${req1Id}/approve`).send({});
  assert.equal(appRes.status, 200);
  assert.equal(appRes.body.synced_days, 2);

  const balRes = await staffApi.get(`/api/leaves/balances?year=2026&employee_id=${empId}`);
  const empBal = balRes.body.data.find((b) => b.leave_type_id === annualType.id);
  assert.equal(empBal.used, 2);
  assert.equal(empBal.remaining, 10);

  const detailAtt = await staffApi.get(`/api/attendance/daily-detail/${empId}?period=2026-11`);
  assert.equal(detailAtt.body.data.length, 2);
  assert.equal(detailAtt.body.data[0].status, 'Cuti');

  // Unpaid leave counts toward Tidak Hadir & absent deduction
  const unpaidReq = await staffApi.post('/api/leaves/requests').send({
    employee_id: empId,
    leave_type_id: unpaidType.id,
    start_date: '2026-11-15',
    end_date: '2026-11-15',
    reason: 'Izin pribadi tidak dibayar',
  });
  assert.equal(unpaidReq.status, 201);
  const unpaidApprove = await financeApi.put(`/api/leaves/requests/${unpaidReq.body.data.id}/approve`).send({});
  assert.equal(unpaidApprove.status, 200);

  const monthSum = await staffApi.get('/api/attendance/monthly?period=2026-11');
  const sumRow = monthSum.body.data.find((r) => r.id === empId);
  assert.equal(sumRow.days_cuti, 2);
  assert.equal(sumRow.days_absent, 1);
  assert.ok(sumRow.deduction_absent > 0);

  // Cancel approved annual leave restores quota & deletes [Cuti] rows
  const cancelRes = await financeApi.put(`/api/leaves/requests/${req1Id}/cancel`).send({});
  assert.equal(cancelRes.status, 200);

  const balAfter = await staffApi.get(`/api/leaves/balances?year=2026&employee_id=${empId}`);
  assert.equal(balAfter.body.data.find((b) => b.leave_type_id === annualType.id).used, 0);
  const detailAfter = await staffApi.get(`/api/attendance/daily-detail/${empId}?period=2026-11`);
  assert.equal(detailAfter.body.data.filter((d) => d.status === 'Cuti').length, 0);
});

test('Loans, Overtime, Reimbursement, THR & Statutory BPJS/PPh21 Payroll Flow', async () => {
  const empRes = await financeApi.post('/api/staff').send({
    name: 'Karyawan Payroll Full QA',
    employee_type: 'Staff',
    position: 'Store Manager',
    salary: 7500000,
    allowance: 500000,
    ptkp_status: 'TK/0',
    enable_bpjs: true,
    enable_pph21: true,
    hire_date: '2024-01-01',
  });
  const empId = empRes.body.employeeId;

  // Create 900k 3-month loan starting 2026-12 and pay 300k manually -> 600k remaining
  const loanRes = await financeApi.post('/api/loans').send({
    employee_id: empId,
    loan_type: 'Kasbon',
    principal_amount: 900000,
    tenor_months: 3,
    start_period: '2026-12',
  });
  assert.equal(loanRes.status, 201);
  const loanId = loanRes.body.data.id;
  assert.equal(loanRes.body.data.monthly_installment, 300000);

  const manPay = await financeApi.post(`/api/loans/${loanId}/payment`).send({ amount: 300000, payment_method: 'Tunai' });
  assert.equal(manPay.status, 200);
  assert.equal(manPay.body.data.remaining_amount, 600000);

  // Overtime (within 2026-12 period: Nov 29..Dec 28) & Reimbursement submitted by staff, approved by finance
  const otRes = await staffApi.post('/api/claims/overtime').send({
    employee_id: empId,
    date: '2026-12-05',
    hours: 2,
    day_type: 'weekday',
    reason: 'Audit tutup toko',
  });
  assert.equal(otRes.status, 201);
  assert.ok(otRes.body.data.calculated_amount > 0);
  assert.equal((await financeApi.put(`/api/claims/overtime/${otRes.body.data.id}/approve`).send({})).status, 200);

  const reimbRes = await staffApi.post('/api/claims/reimbursements').send({
    employee_id: empId,
    claim_date: '2026-12-06',
    category: 'Transportasi',
    amount: 75000,
    description: 'Bensin antar stok',
  });
  assert.equal(reimbRes.status, 201);
  assert.equal((await financeApi.put(`/api/claims/reimbursements/${reimbRes.body.data.id}/approve`).send({ payroll_period: '2026-12' })).status, 200);

  // Enable global BPJS + PPh 21 switches
  const setRes = await masterApi.put('/api/settings').send({
    bpjs_payroll_enabled: '1',
    pph21_payroll_enabled: '1',
  });
  assert.equal(setRes.status, 200);

  // Generate Draft payroll 2026-12 twice -> verify idempotent loan installment, overtime, reimb, BPJS, PPh21
  assert.equal((await financeApi.post('/api/payroll/periods/2026-12/generate').send({})).status, 200);
  assert.equal((await financeApi.post('/api/payroll/periods/2026-12/generate').send({})).status, 200);

  const entriesRes = await financeApi.get('/api/payroll/periods/2026-12/entries');
  const entry = entriesRes.body.data.find((e) => e.employee_id === empId);
  assert.ok(entry);
  assert.equal(entry.overtime_pay, otRes.body.data.calculated_amount);
  assert.equal(entry.reimbursement_pay, 75000);
  assert.equal(entry.deduction_loan, 300000);
  assert.equal(entry.bpjs_kes_emp, 80000);   // 1% of 8M
  assert.equal(entry.bpjs_tk_emp, 240000);   // 3% of 8M (JHT 2% + JP 1%)
  assert.ok(entry.pph21_deduction > 0);

  // Apply THR for 2026-12
  const thrRes = await financeApi.post('/api/claims/thr/apply').send({
    period: '2026-12',
    target_date: '2026-12-20',
    employee_ids: [empId],
  });
  assert.equal(thrRes.status, 200);

  const slipRes = await financeApi.get(`/api/payroll/entries/${entry.id}/slip`);
  assert.equal(slipRes.status, 200);
  assert.equal(slipRes.body.data.thr_pay, 8000000);
  assert.equal(slipRes.body.data.ptkp_status, 'TK/0');

  // Submit payroll period -> posts loan payment & marks reimbursement Paid
  const submitRes = await financeApi.put('/api/payroll/periods/2026-12/submit').send({});
  assert.equal(submitRes.status, 200);

  const loanAfter = await financeApi.get(`/api/loans/${loanId}`);
  assert.equal(loanAfter.body.data.remaining_amount, 300000);
  assert.ok(loanAfter.body.data.payments.some((p) => p.payment_method === 'Potong Gaji' && p.period === '2026-12'));

  const finalPay = await financeApi.post(`/api/loans/${loanId}/payment`).send({ amount: 300000, payment_method: 'Transfer' });
  assert.equal(finalPay.status, 200);
  assert.equal(finalPay.body.data.status, 'Paid Off');

  const reimbAfter = await staffApi.get(`/api/claims/reimbursements?employee_id=${empId}`);
  assert.equal(reimbAfter.body.data[0].status, 'Paid');

  // Reset global BPJS/PPh21 toggles back to off in this test DB
  await masterApi.put('/api/settings').send({ bpjs_payroll_enabled: '0', pph21_payroll_enabled: '0' });
});

test('Mobile Geofence check-in, Dashboard analytics & RBAC boundaries', async () => {
  const bRes = await masterApi.post('/api/branches').send({
    code: 'SF-GF1',
    name: 'Cabang Geofence QA',
    location_type: 'Konter',
    latitude: -6.200000,
    longitude: 106.816666,
    geofence_radius_m: 150,
  });
  assert.equal(bRes.status, 200);
  const branchId = bRes.body.data.id;

  const empRes = await financeApi.post('/api/staff').send({
    name: 'Karyawan Geofence QA',
    branch_id: branchId,
    employee_type: 'Frontliner',
    salary: 3000000,
  });
  const empId = empRes.body.employeeId;

  // Inside radius (~45m) succeeds
  const okCheckin = await staffApi.post('/api/mobile/attendance/checkin').send({
    employee_id: empId,
    shift: 'Pagi',
    latitude: -6.2003,
    longitude: 106.8167,
    date: '2026-11-25',
    check_in_time: '06:20',
  });
  assert.equal(okCheckin.status, 200);
  assert.ok(['Hadir', 'Terlambat'].includes(okCheckin.body.data.status));
  assert.ok(okCheckin.body.data.distance_m <= 150);

  // Outside radius (~6.6km) rejected with OUTSIDE_GEOFENCE
  const farCheckin = await staffApi.post('/api/mobile/attendance/checkin').send({
    employee_id: empId,
    shift: 'Pagi',
    latitude: -6.2500,
    longitude: 106.8500,
    date: '2026-11-26',
    check_in_time: '06:20',
  });
  assert.equal(farCheckin.status, 400);
  assert.equal(farCheckin.body.code, 'OUTSIDE_GEOFENCE');

  // Dashboard summary exposes new SunFish sections
  const dashRes = await masterApi.get('/api/dashboard/master-summary');
  assert.equal(dashRes.status, 200);
  assert.ok(Array.isArray(dashRes.body.data.contract_alerts));
  assert.ok(dashRes.body.data.pending_approvals && typeof dashRes.body.data.pending_approvals.total === 'number');
  assert.ok(dashRes.body.data.turnover_analytics && typeof dashRes.body.data.turnover_analytics.turnover_rate_pct === 'number');

  // RBAC checks on new endpoints
  for (const blocked of ['/api/loans', '/api/staff/contract-alerts', '/api/claims/thr/preview']) {
    const r = await staffApi.get(blocked);
    assert.equal(r.status, 403, `Expected 403 for staff on ${blocked}`);
    assert.equal(r.body.code, 'FORBIDDEN_ROLE');
  }
});
