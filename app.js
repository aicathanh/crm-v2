const supabaseUrl = 'https://zbnnctvggpupdnjmydcu.supabase.co';
const supabaseKey = 'sb_publishable__Uc7k0lfdHFzBjWT-3o36w_ydCDXOT8';
const client = supabase.createClient(supabaseUrl, supabaseKey);

const STATUS_MAP = { 'quote': 'Báo Giá', 'ordered': 'Chốt Đơn', 'paid': 'Thu Tiền', 'debt': 'Công Nợ', 'archived': 'Lưu Trữ', 'lost': 'Rớt Đơn' };
const NEXT_STATUS = { 'quote': 'ordered', 'ordered': 'paid', 'paid': 'archived', 'debt': 'archived', 'archived': 'quote', 'lost': 'quote' };

let currentMoveData = null;
let selectedLostReason = "";
const THE_PASSWORD = "6688";

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
        if (btn) btn.innerText = 'Đã lưu!';
        setTimeout(() => { if (btn) btn.innerText = 'Lưu ghi chú'; renderBoard(); }, 1500);
    }
}

async function deleteOrder(id) {
    if (confirm('Xóa báo giá này?')) { await client.from('orders').delete().eq('id', id); renderBoard(); }
}

function handleStatusMove(id, newStatus, currentStatus = '') {
    // Nếu chuyển từ Công nợ -> Lưu trữ HOẶC Chốt đơn -> Thu tiền thì đều hỏi tài khoản
    if (newStatus === 'paid' || (currentStatus === 'debt' && newStatus === 'archived')) {
        currentMoveData = { id, status: newStatus };
        document.getElementById('payment-modal').classList.add('active');
    } else if (newStatus === 'lost') {
        currentMoveData = { id, status: newStatus };
        document.getElementById('lost-reason-modal').classList.add('active');
    } else updateOrderStatus(id, newStatus);
}

function createCard(order) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = order.id;
    card.dataset.status = order.status; // Lưu status hiện tại để xử lý logic
    card.dataset.amount = order.amount || 0;
    card.dataset.name = (order.customer_name || '').toLowerCase();
    card.dataset.phone = (order.customer_phone || '').toLowerCase();

    card.innerHTML = `
        <div class="card-title">${order.customer_name || 'N/A'}</div>
        <div class="card-meta">
            <span><i data-lucide="phone" style="width:12px;"></i> ${order.customer_phone || 'N/A'}</span>
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i data-lucide="map-pin" style="width:12px;"></i> ${order.customer_address || 'N/A'}</span>
            ${order.status === 'lost' && order.notes && order.notes.includes('LÝ DO RỚT:') ? `<span style="color:#ef4444; font-weight:700;"><i data-lucide="info" style="width:12px;"></i> ${order.notes.split('LÝ DO RỚT:')[1]}</span>` : ''}
            ${order.payment_account ? `<span style="color:#059669; font-weight:700;"><i data-lucide="building-2" style="width:12px;"></i> ${order.payment_account}</span>` : ''}
        </div>
        <div class="card-tag tag-amount" style="${order.status === 'lost' ? 'background:#fee2e2; color:#991b1b; border-color:#fecaca;' : ''}">${formatVND(order.amount || 0)}</div>
        <div class="card-actions">
            <button class="action-btn move-btn" title="Chuyển tiếp"><i data-lucide="arrow-right-circle"></i></button>
            <button class="action-btn delete-btn" style="color:#ef4444;" title="Xóa"><i data-lucide="trash-2"></i></button>
        </div>
    `;

    let lastTap = 0;
    card.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) { e.preventDefault(); showDetails(order); }
        lastTap = currentTime;
    });
    card.ondblclick = () => showDetails(order);

    card.querySelector('.move-btn').onclick = (e) => { e.stopPropagation(); handleStatusMove(order.id, NEXT_STATUS[order.status] || 'archived', order.status); };
    card.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); deleteOrder(order.id); };

    return card;
}

function showDetails(order) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-title').innerText = `Chi tiết: ${order.customer_name}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
            <p><strong>Khách hàng:</strong> ${order.customer_name}</p>
            <p><strong>SĐT:</strong> <a href="tel:${order.customer_phone}" style="color:#2563eb; font-weight:700;">${order.customer_phone || 'N/A'}</a></p>
            <p><strong>Địa chỉ:</strong> ${order.customer_address || 'N/A'}</p>
            <hr>
            <textarea id="order-notes" style="width:100%; height:80px; padding:12px; border-radius:10px; border:1px solid #ddd; font-family:inherit;" placeholder="Ghi chú thêm...">${order.notes || ''}</textarea>
            <button class="save-notes-btn" style="padding:12px; background:#2563eb; color:white; border:none; border-radius:10px; font-weight:700; cursor:pointer;">Lưu ghi chú</button>
            <hr>
            <p><strong>Sản phẩm:</strong><br><small style="color:#64748b; line-height:1.4;">${order.products || 'N/A'}</small></p>
            <p style="font-size:1.2rem; font-weight:800; color:#166534; display:flex; justify-content:space-between;"><span>TỔNG:</span> <span>${formatVND(order.amount || 0)}</span></p>
        </div>
    `;
    document.querySelector('.save-notes-btn').onclick = () => updateNotes(order.id, document.getElementById('order-notes').value);
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

async function openCustomerList() {
    const orders = await fetchOrders();
    const customers = {};
    orders.forEach(o => {
        const key = o.customer_phone || o.customer_name;
        if (!customers[key]) customers[key] = { name: o.customer_name, phone: o.customer_phone, address: o.customer_address, total: 0, count: 0 };
        if (o.status !== 'lost' && o.status !== 'quote') customers[key].total += parseFloat(o.amount || 0);
        customers[key].count += 1;
    });
    const tbody = document.getElementById('customer-table-body');
    tbody.innerHTML = Object.values(customers).sort((a,b) => b.total - a.total).map(c => `
        <tr><td style="font-weight:700;">${c.name}</td><td>${c.phone || 'N/A'}</td><td style="font-size:0.75rem;">${c.address || 'N/A'}</td><td style="font-weight:800; color:#166534;">${formatVND(c.total)}</td><td style="text-align:center;">${c.count}</td></tr>
    `).join('');
    document.getElementById('customer-modal').classList.add('active');
}

async function openDashboard() {
    const orders = await fetchOrders();
    const yFilter = document.getElementById('year-filter');
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear]); orders.forEach(o => years.add(new Date(o.created_at).getFullYear()));
    yFilter.innerHTML = Array.from(years).sort((a,b) => b-a).map(y => `<option value="${y}">Năm ${y}</option>`).join('');

    const month = document.getElementById('month-filter').value;
    const year = yFilter.value;
    const active = orders.filter(o => o.status === 'paid' || o.status === 'debt');
    const activeData = calculateStats(active);
    const activeDebt = active.filter(o => o.status === 'debt').reduce((s, o) => s + parseFloat(o.amount || 0), 0);
    
    document.getElementById('active-account-stats').innerHTML = `
        <div style="display:flex; justify-content:space-around; gap:10px; margin-bottom:20px; background:#eff6ff; padding:15px; border-radius:12px; flex-wrap:wrap;">
            <div style="text-align:center; min-width:120px;"><div>TỔNG DOANH SỐ</div><strong>${formatVND(activeData.totalRevenue)}</strong></div>
            <div style="text-align:center;">CÔNG TY<br><span style="color:#2563eb; font-weight:700;">${formatVND(activeData.accountMap['Công ty'])}</span></div>
            <div style="text-align:center;">THANH<br><span style="color:#059669; font-weight:700;">${formatVND(activeData.accountMap['Thanh'])}</span></div>
            <div style="text-align:center; color:red;">ĐANG NỢ<br><strong>${formatVND(activeDebt)}</strong></div>
        </div>
    `;

    const archived = orders.filter(o => { const d = new Date(o.created_at); return o.status === 'archived' && d.getFullYear().toString() === year && (month === 'all' ? true : d.getMonth().toString() === month); });
    const archData = calculateStats(archived);
    document.getElementById('archived-account-stats').innerHTML = `
        <div style="display:flex; justify-content:space-around; gap:10px; margin-bottom:20px; background:#f5f3ff; padding:15px; border-radius:12px; flex-wrap:wrap;">
            <div style="text-align:center; min-width:120px;"><div>TỔNG LỊCH SỬ</div><strong>${formatVND(archData.totalRevenue)}</strong></div>
            <div style="text-align:center;">CÔNG TY<br><strong>${formatVND(archData.accountMap['Công ty'])}</strong></div>
            <div style="text-align:center;">THANH<br><strong>${formatVND(archData.accountMap['Thanh'])}</strong></div>
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

function checkAuth() {
    if (localStorage.getItem('crm_auth') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        renderBoard();
    }
}

function handleLogin() {
    if (document.getElementById('pass-input').value === THE_PASSWORD) { localStorage.setItem('crm_auth', 'true'); checkAuth(); }
    else { document.getElementById('login-err').style.display = 'block'; }
}

function initDragAndDrop() {
    document.querySelectorAll('.cards-container').forEach(container => {
        new Sortable(container, {
            group: 'shared', animation: 250,
            delay: 150, delayOnTouchOnly: true,
            touchStartThreshold: 5,
            forceFallback: true,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: async (evt) => {
                const id = evt.item.dataset.id;
                const newStatus = evt.to.closest('.column').dataset.status;
                const oldStatus = evt.from.closest('.column').dataset.status;
                if (newStatus !== oldStatus) {
                    // CẬP NHẬT: Thêm logic hỏi tài khoản khi từ Công nợ -> Lưu trữ
                    if (newStatus === 'paid' || (oldStatus === 'debt' && newStatus === 'archived')) {
                        currentMoveData = { id, status: newStatus };
                        document.getElementById('payment-modal').classList.add('active');
                    }
                    else if (newStatus === 'lost') {
                        currentMoveData = { id, status: newStatus };
                        document.getElementById('lost-reason-modal').classList.add('active');
                    }
                    else { await updateOrderStatus(id, newStatus, true); }
                    updateColumnStats();
                }
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkAuth();
    initDragAndDrop();

    document.getElementById('login-btn').onclick = handleLogin;
    document.getElementById('pass-input').onkeypress = (e) => { if (e.key === 'Enter') handleLogin(); };
    document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('crm_auth'); location.reload(); };
    document.getElementById('dashboard-btn').onclick = openDashboard;
    document.getElementById('customer-btn').onclick = openCustomerList;
    document.getElementById('search-input').oninput = applySearch;
    document.getElementById('month-filter').onchange = openDashboard;
    document.getElementById('year-filter').onchange = openDashboard;
    
    document.querySelectorAll('.btn-account').forEach(btn => {
        btn.onclick = () => {
            if (currentMoveData) {
                updateOrderStatus(currentMoveData.id, currentMoveData.status, false, { payment_account: btn.innerText });
                document.getElementById('payment-modal').classList.remove('active');
                currentMoveData = null;
            }
        };
    });

    document.querySelectorAll('.btn-lost-reason').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.btn-lost-reason').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedLostReason = btn.dataset.reason;
        };
    });

    document.getElementById('submit-lost-reason').onclick = async () => {
        const reason = document.getElementById('custom-lost-reason').value || selectedLostReason;
        if (!reason) { alert('Vui lòng chọn hoặc nhập lý do!'); return; }
        if (currentMoveData) {
            const orders = await fetchOrders();
            const order = orders.find(o => o.id == currentMoveData.id);
            const newNotes = (order.notes ? order.notes + "\n" : "") + "LÝ DO RỚT: " + reason;
            await updateOrderStatus(currentMoveData.id, 'lost', false, { notes: newNotes });
            document.getElementById('lost-reason-modal').classList.remove('active');
            currentMoveData = null;
            selectedLostReason = "";
            document.getElementById('custom-lost-reason').value = "";
        }
    };

    document.querySelectorAll('.modal-close-trigger').forEach(b => {
        b.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            if (currentMoveData && (currentMoveData.status === 'lost' || currentMoveData.status === 'archived')) renderBoard();
        };
    });

    window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };
});
