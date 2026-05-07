const supabaseUrl = 'https://zbnnctvggpupdnjmydcu.supabase.co';
const supabaseKey = 'sb_publishable__Uc7k0lfdHFzBjWT-3o36w_ydCDXOT8';
const client = supabase.createClient(supabaseUrl, supabaseKey);

const STATUS_MAP = { 'quote': 'Báo Giá', 'ordered': 'Chốt Đơn', 'paid': 'Thu Tiền', 'debt': 'Công Nợ', 'archived': 'Lưu Trữ' };
const NEXT_STATUS = { 'quote': 'ordered', 'ordered': 'paid', 'paid': 'archived', 'debt': 'paid', 'archived': 'quote' };

let currentMoveData = null;

const formatVND = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

async function fetchOrders() {
    const { data, error } = await client.from('orders').select('*').order('created_at', { ascending: false });
    return error ? [] : data;
}

async function updateOrderStatus(id, newStatus, silent = false, extraData = {}) {
    const { error } = await client.from('orders').update({ status: newStatus, ...extraData }).eq('id', id);
    if (!error && !silent) renderBoard();
}

async function updateNotes(id, notes) {
    const { error } = await client.from('orders').update({ notes }).eq('id', id);
    if (!error) {
        const btn = document.querySelector('.save-notes-btn');
        btn.innerText = 'Đã lưu!';
        setTimeout(() => { btn.innerText = 'Lưu ghi chú'; renderBoard(); }, 1500);
    }
}

async function deleteOrder(id) {
    if (confirm('Xóa báo giá này?')) { await client.from('orders').delete().eq('id', id); renderBoard(); }
}

function handleStatusMove(id, newStatus) {
    if (newStatus === 'paid') {
        currentMoveData = { id, status: newStatus };
        document.getElementById('payment-modal').classList.add('active');
    } else updateOrderStatus(id, newStatus);
}

function createCard(order) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = order.id;
    card.dataset.amount = order.amount || 0;
    card.dataset.name = (order.customer_name || '').toLowerCase();
    card.dataset.phone = (order.customer_phone || '').toLowerCase();

    card.innerHTML = `
        <div class="card-title">${order.customer_name || 'N/A'}</div>
        <div class="card-meta">
            <span><i data-lucide="phone" style="width:12px;"></i> ${order.customer_phone || 'N/A'}</span>
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i data-lucide="map-pin" style="width:12px;"></i> ${order.customer_address || 'N/A'}</span>
            ${order.payment_account ? `<span style="color:#059669; font-weight:600;"><i data-lucide="building-2" style="width:12px;"></i> ${order.payment_account}</span>` : ''}
            ${order.notes ? `<span style="color:#9333ea; font-style:italic;"><i data-lucide="sticky-note" style="width:12px;"></i> Có ghi chú</span>` : ''}
        </div>
        <div class="card-tag tag-amount">${formatVND(order.amount || 0)}</div>
        <div class="card-actions">
            <button class="action-btn move-btn"><i data-lucide="arrow-right-circle"></i></button>
            <button class="action-btn view-btn"><i data-lucide="eye"></i></button>
            <button class="action-btn delete-btn" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>
        </div>
    `;

    card.querySelector('.move-btn').addEventListener('click', (e) => { e.stopPropagation(); handleStatusMove(order.id, NEXT_STATUS[order.status] || 'archived'); });
    card.querySelector('.view-btn').addEventListener('click', (e) => { e.stopPropagation(); showDetails(order); });
    card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteOrder(order.id); });

    return card;
}

function showDetails(order) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-title').innerText = `Chi tiết: ${order.customer_name}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
            <p><strong>Khách hàng:</strong> ${order.customer_name}</p>
            <p><strong>SĐT:</strong> ${order.customer_phone || 'N/A'}</p>
            <p><strong>Địa chỉ:</strong> ${order.customer_address || 'N/A'}</p>
            <p><strong>Tài khoản:</strong> ${order.payment_account || 'N/A'}</p>
            <hr>
            <textarea id="order-notes" style="width:100%; height:60px; padding:8px; border-radius:6px; border:1px solid #ddd;" placeholder="Ghi chú...">${order.notes || ''}</textarea>
            <button class="save-notes-btn" style="padding:8px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer;">Lưu ghi chú</button>
            <hr>
            <p><strong>Sản phẩm:</strong><br><small>${order.products || 'N/A'}</small></p>
            <p><strong>Tổng cộng:</strong> <span style="font-weight:800; color:#166534;">${formatVND(order.amount || 0)}</span></p>
        </div>
    `;
    document.querySelector('.save-notes-btn').addEventListener('click', () => updateNotes(order.id, document.getElementById('order-notes').value));
    modal.classList.add('active');
}

async function renderBoard() {
    const orders = await fetchOrders();
    document.querySelectorAll('.column .cards-container').forEach(c => c.innerHTML = '');
    orders.forEach(o => {
        const col = document.querySelector(`.column[data-status="${o.status || 'quote'}"]`);
        if (col) col.querySelector('.cards-container').appendChild(createCard(o));
    });
    updateColumnStats();
    applySearch();
    lucide.createIcons();
}

function applySearch() {
    const q = document.getElementById('search-input').value.toLowerCase();
    document.querySelectorAll('.card').forEach(c => {
        if (c.dataset.name.includes(q) || c.dataset.phone.includes(q)) c.classList.remove('hidden'); else c.classList.add('hidden');
    });
    updateColumnStats();
}

function updateColumnStats() {
    document.querySelectorAll('.column').forEach(col => {
        const visible = col.querySelectorAll('.card:not(.hidden)');
        col.querySelector('.count').innerText = visible.length;
        let total = 0; visible.forEach(c => total += parseFloat(c.dataset.amount || 0));
        col.querySelector('.total-amount').innerText = formatVND(total);
    });
}

// CUSTOMER MANAGEMENT
async function openCustomerList() {
    const orders = await fetchOrders();
    const customers = {};
    orders.forEach(o => {
        const key = o.customer_phone || o.customer_name;
        if (!customers[key]) {
            customers[key] = { name: o.customer_name, phone: o.customer_phone, address: o.customer_address, total: 0, count: 0 };
        }
        customers[key].total += parseFloat(o.amount || 0);
        customers[key].count += 1;
    });

    const tbody = document.getElementById('customer-table-body');
    tbody.innerHTML = Object.values(customers).sort((a,b) => b.total - a.total).map(c => `
        <tr>
            <td style="font-weight:600;">${c.name}</td>
            <td>${c.phone || 'N/A'}</td>
            <td style="font-size:0.8rem; max-width:200px;">${c.address || 'N/A'}</td>
            <td style="font-weight:700; color:#166534;">${formatVND(c.total)}</td>
            <td style="text-align:center;">${c.count}</td>
        </tr>
    `).join('');

    document.getElementById('customer-modal').classList.add('active');
    lucide.createIcons();
}

function exportToExcel() {
    const tbody = document.getElementById('customer-table-body');
    const rows = tbody.querySelectorAll('tr');
    let csv = '\uFEFF'; // UTF-8 BOM for Excel
    csv += 'Họ tên,Số điện thoại,Địa chỉ,Tổng mua,Số đơn\n';
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        const data = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`);
        csv += data.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Danh_sach_khach_hang_${new Date().toLocaleDateString('vi-VN')}.csv`;
    link.click();
}

// DASHBOARD
async function openDashboard() {
    const orders = await fetchOrders();
    const yFilter = document.getElementById('year-filter');
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear]); orders.forEach(o => years.add(new Date(o.created_at).getFullYear()));
    const sortedYears = Array.from(years).sort((a,b) => b-a);
    yFilter.innerHTML = sortedYears.map(y => `<option value="${y}">Năm ${y}</option>`).join('');

    const month = document.getElementById('month-filter').value;
    const year = yFilter.value;
    
    // Active Stats
    const active = orders.filter(o => o.status === 'paid' || o.status === 'debt');
    const activeData = calculateStats(active);
    const activeDebt = active.filter(o => o.status === 'debt').reduce((s, o) => s + parseFloat(o.amount || 0), 0);
    
    document.getElementById('active-account-stats').innerHTML = `
        <div style="flex:1; text-align:center; border-right:1px solid #eee;">
            <div style="font-size:0.7rem; color:#64748b;">TỔNG DOANH SỐ HIỆN TẠI</div>
            <div style="font-size:1.1rem; font-weight:800;">${formatVND(activeData.totalRevenue)}</div>
        </div>
        <div style="flex:2; display:flex; justify-content:space-around;">
            <div style="text-align:center;"><small>CÔNG TY</small><br><span style="color:#2563eb; font-weight:700;">${formatVND(activeData.accountMap['Công ty'])}</span></div>
            <div style="text-align:center;"><small>THANH</small><br><span style="color:#059669; font-weight:700;">${formatVND(activeData.accountMap['Thanh'])}</span></div>
            <div style="text-align:center;"><small style="color:red;">ĐANG NỢ</small><br><span style="color:red; font-weight:700;">${formatVND(activeDebt)}</span></div>
        </div>
    `;

    // Archived Stats
    const archived = orders.filter(o => {
        const d = new Date(o.created_at);
        return o.status === 'archived' && d.getFullYear().toString() === year && (month === 'all' ? true : d.getMonth().toString() === month);
    });
    const archData = calculateStats(archived);
    document.getElementById('archived-account-stats').innerHTML = `
        <div style="flex:1; text-align:center; border-right:1px solid #eee;">
            <div style="font-size:0.7rem; color:#6366f1;">TỔNG LỊCH SỬ HOÀN THÀNH</div>
            <div style="font-size:1.1rem; font-weight:800; color:#4338ca;">${formatVND(archData.totalRevenue)}</div>
        </div>
        <div style="flex:1; display:flex; justify-content:space-around;">
            <div style="text-align:center;"><small>CÔNG TY</small><br><span style="font-weight:700;">${formatVND(archData.accountMap['Công ty'])}</span></div>
            <div style="text-align:center;"><small>THANH</small><br><span style="font-weight:700;">${formatVND(archData.accountMap['Thanh'])}</span></div>
        </div>
    `;

    renderStatList('active-top-customers', activeData.topCustomers);
    renderStatList('active-top-products', activeData.topProducts);
    renderStatList('archived-top-customers', archData.topCustomers);
    renderStatList('archived-top-products', archData.topProducts);
    document.getElementById('dashboard-modal').classList.add('active');
}

function calculateStats(orders) {
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.amount || 0), 0);
    const accountMap = { 'Công ty': 0, 'Thanh': 0 };
    orders.forEach(o => { if (o.payment_account) accountMap[o.payment_account] += parseFloat(o.amount || 0); });
    const cMap = {}; orders.forEach(o => { const n = o.customer_name || 'Khách'; cMap[n] = (cMap[n] || 0) + parseFloat(o.amount || 0); });
    const pMap = {}; orders.forEach(o => { if (o.products) o.products.split(', ').forEach(p => { const m = p.match(/(.+)\((.+)kg-(\d+)-(\d+)\)/); if (m) pMap[m[1]] = (pMap[m[1]] || 0) + parseFloat(m[4]); }); });
    return { totalRevenue, accountMap, topCustomers: Object.entries(cMap).sort((a,b)=>b[1]-a[1]).slice(0,5), topProducts: Object.entries(pMap).sort((a,b)=>b[1]-a[1]).slice(0,5) };
}

function renderStatList(id, data) {
    document.getElementById(id).innerHTML = data.map(([n, v]) => `<div class="stat-item"><span>${n}</span><span class="stat-val">${formatVND(v)}</span></div>`).join('') || 'Trống';
}

document.addEventListener('DOMContentLoaded', () => {
    renderBoard();
    document.getElementById('refresh-btn').onclick = renderBoard;
    document.getElementById('dashboard-btn').onclick = openDashboard;
    document.getElementById('customer-btn').onclick = openCustomerList;
    document.getElementById('export-btn').onclick = exportToExcel;
    document.getElementById('search-input').oninput = applySearch;
    document.getElementById('month-filter').onchange = openDashboard;
    document.getElementById('year-filter').onchange = openDashboard;
    
    document.querySelectorAll('.btn-account').forEach(btn => {
        btn.onclick = () => {
            if (currentMoveData) {
                updateOrderStatus(currentMoveData.id, currentMoveData.status, false, { payment_account: btn.dataset.account });
                document.getElementById('payment-modal').classList.remove('active');
                currentMoveData = null;
            }
        };
    });

    document.querySelectorAll('.close-btn').forEach(b => b.onclick = () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')));
    window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };
});
