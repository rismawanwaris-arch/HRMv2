const test = require('node:test');
const assert = require('node:assert/strict');
const { app, dbReady, login, authed } = require('./helpers');

test('outlet activity lifecycle, daily summary, and WhatsApp report', async () => {
  await dbReady();
  const token = await login();
  const api = authed(token);

  // 1. Create a test branch
  const branchRes = await api.post('/api/branches').send({
    code: 'TEST-O1',
    name: 'Bandar Kuota Antapani',
    address: 'Jl. Purwakarta No. 12',
    city: 'Bandung'
  });
  assert.equal(branchRes.status, 200);
  const branchId = branchRes.body.data.id;

  // 2. Record a store visit
  const today = new Date().toISOString().split('T')[0];
  const visitRes = await api.post('/api/outlet-activity/visits').send({
    branch_id: branchId,
    visit_date: today,
    visit_time: '10:30',
    visitor_name: 'Wisnu',
    purpose: 'Audit Kebersihan & Edukasi Kasir',
    status: 'Completed',
    score_cleanliness: 90,
    score_security: 95,
    score_display: 90,
    score_sop: 85,
    notes: 'Kondisi outlet bersih, kasir siap dan ramah.',
    action_plan: 'Review kembali SOP upselling kartu perdana'
  });
  assert.equal(visitRes.status, 201);
  assert.ok(visitRes.body.id);
  const visitId = visitRes.body.id;

  // 3. Record an incident for this branch
  const incidentRes = await api.post('/api/outlet-activity/incidents').send({
    branch_id: branchId,
    visit_id: visitId,
    incident_date: today,
    category: 'Kerusakan Fasilitas',
    severity: 'Medium',
    title: 'Lampu Neon Sign Redup',
    description: 'Lampu neon sign bagian depan berkedip dan redup saat dinyalakan.',
    action_taken: 'Sudah dihubungi teknisi listrik',
    reported_by: 'Wisnu'
  });
  assert.equal(incidentRes.status, 201);
  assert.ok(incidentRes.body.id);

  // 4. Create an action item (PR)
  const actionRes = await api.post('/api/outlet-activity/action-items').send({
    branch_id: branchId,
    visit_id: visitId,
    task_description: 'Ganti starter neon sign depan',
    assigned_to: 'Pak Asep (Teknisi)',
    due_date: today,
    priority: 'High'
  });
  assert.equal(actionRes.status, 201);
  assert.ok(actionRes.body.id);
  const actionId = actionRes.body.id;

  // 5. Fetch daily summary
  const summaryRes = await api.get(`/api/outlet-activity/summary?date=${today}`);
  assert.equal(summaryRes.status, 200);
  assert.equal(summaryRes.body.success, true);
  assert.equal(summaryRes.body.data.metrics.totalVisits, 1);
  assert.equal(summaryRes.body.data.metrics.completedVisits, 1);
  assert.ok(summaryRes.body.data.metrics.avgScore >= 85);
  assert.equal(summaryRes.body.data.metrics.totalIncidents, 1);

  // Check WhatsApp text contains key information
  const wa = summaryRes.body.data.whatsappText;
  assert.ok(wa.includes('LAPORAN HARIAN HR/GA & OUTLET VISIT'));
  assert.ok(wa.includes('BANDAR KUOTA ANTAPANI'));
  assert.ok(wa.includes('Audit Kebersihan & Edukasi Kasir'));
  assert.ok(wa.includes('Lampu Neon Sign Redup'));

  // 6. Branch history
  const historyRes = await api.get(`/api/outlet-activity/branches/${branchId}/history`);
  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.body.data.visits.length, 1);
  assert.equal(historyRes.body.data.incidents.length, 1);
  assert.equal(historyRes.body.data.action_items.length, 1);

  // 7. Mark action item as done
  const updateActionRes = await api.put(`/api/outlet-activity/action-items/${actionId}`).send({
    status: 'Done',
    completion_notes: 'Lampu sudah diganti dan menyala terang'
  });
  assert.equal(updateActionRes.status, 200);

  const getActionRes = await api.get(`/api/outlet-activity/action-items?branch_id=${branchId}`);
  assert.equal(getActionRes.status, 200);
  assert.equal(getActionRes.body.data[0].status, 'Done');
});
