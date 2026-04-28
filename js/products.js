// products.js - وحدة إدارة الأصناف (متوافقة مع SQLite)
console.log('📦 تحميل وحدة الأصناف...');

// ======================== دوال تهيئة ========================
function initProducts() {
    ensureDefaultUnitsAndCategories();
}

function ensureDefaultUnitsAndCategories() {
    const units = ['قطعة', 'كيلوغرام', 'متر', 'لتر', 'علبة', 'كرتون'];
    units.forEach(u => run(`INSERT OR IGNORE INTO units (name) VALUES (?)`, [u]));
    
    const categories = ['عام', 'بذور', 'أسمدة', 'مبيدات', 'معدات'];
    categories.forEach(c => run(`INSERT OR IGNORE INTO item_categories (name) VALUES (?)`, [c]));
}

// ======================== صفحات الوحدة ========================
function productsPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-box"></i> إدارة الأصناف</h2>
            <button onclick="newProductPage()"><i class="fas fa-plus"></i> إضافة صنف</button>
            <button onclick="productsListPage()"><i class="fas fa-table"></i> قائمة الأصناف</button>
            <button onclick="dashboard()"><i class="fas fa-arrow-right"></i> رجوع</button>
        </div>
    `;
}

function newProductPage() {
    const units = query('SELECT id, name FROM units ORDER BY name');
    const categories = query('SELECT id, name FROM item_categories ORDER BY name');
    
    let unitOptions = '<option value="">اختر الوحدة</option>';
    units.forEach(u => unitOptions += `<option value="${u[0]}">${u[1]}</option>`);
    
    let categoryOptions = '<option value="">اختر الفئة</option>';
    categories.forEach(c => categoryOptions += `<option value="${c[0]}">${c[1]}</option>`);
    
    content.innerHTML = `
        <div class="card">
            <h3>إضافة صنف جديد</h3>
            <label>اسم الصنف</label>
            <input id="pName" placeholder="اسم الصنف">
            <label>الباركود (اختياري)</label>
            <input id="pBarcode" placeholder="الباركود">
            <label>الوحدة</label>
            <select id="pUnit">${unitOptions}</select>
            <label>الفئة</label>
            <select id="pCategory">${categoryOptions}</select>
            <label>سعر الشراء</label>
            <input id="pBuy" type="number" step="0.01" value="0">
            <label>سعر البيع</label>
            <input id="pSell" type="number" step="0.01" value="0">
            <label>العملة</label>
            <select id="pCurrency">
                <option value="YER">ريال يمني</option>
                <option value="USD">دولار</option>
                <option value="SAR">ريال سعودي</option>
            </select>
            <label>ملاحظات</label>
            <textarea id="pNotes" placeholder="ملاحظات"></textarea>
            <br>
            <button onclick="addProduct()">حفظ</button>
            <button onclick="productsPage()">إلغاء</button>
        </div>
    `;
}

function productsListPage() {
    const products = query(`
        SELECT i.id, i.code, i.name, i.barcode, u.name as unit_name, c.name as category_name,
               i.purchase_cost, i.sales_price, i.currency, i.notes, i.current_stock
        FROM items i
        LEFT JOIN units u ON i.unit_id = u.id
        LEFT JOIN item_categories c ON i.category_id = c.id
        WHERE i.is_active = 1
        ORDER BY i.name
    `);
    
    let rows = '';
    products.forEach(p => {
        const id = p[0];
        const name = p[2] || '';
        const barcode = p[3] || '';
        const unit = p[4] || '-';
        const buyPrice = p[6] || 0;
        const sellPrice = p[7] || 0;
        const currency = p[8] || 'YER';
        const stock = p[10] || 0;
        
        rows += `<tr>
            <td>${name}</td><td>${barcode}</td><td>${unit}</td>
            <td>${buyPrice.toFixed(2)}</td><td>${sellPrice.toFixed(2)}</td>
            <td>${currency}</td><td>${stock}</td>
            <td>
                <button onclick="viewProduct(${id})">عرض</button>
                <button onclick="editProduct(${id})">تعديل</button>
                <button onclick="deleteProduct(${id})">حذف</button>
            </td>
        </tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h3>قائمة الأصناف</h3>
            <input id="productSearch" placeholder="ابحث باسم الصنف أو الباركود" oninput="searchProducts()">
        </div>
        <div class="card">
            <table id="productsTable">
                <thead><tr><th>الاسم</th><th>الباركود</th><th>الوحدة</th><th>شراء</th><th>بيع</th><th>العملة</th><th>المخزون</th><th></th></tr></thead>
                <tbody>${rows || "<tr><td colspan='8'>لا توجد أصناف</td></tr>"}</tbody>
            </table>
            <button onclick="productsPage()">رجوع</button>
        </div>
    `;
}

function searchProducts() {
    const q = document.getElementById('productSearch').value.toLowerCase();
    const products = query(`
        SELECT i.id, i.code, i.name, i.barcode, u.name, i.purchase_cost, i.sales_price, i.currency, i.current_stock
        FROM items i
        LEFT JOIN units u ON i.unit_id = u.id
        WHERE i.is_active = 1 AND (LOWER(i.name) LIKE ? OR LOWER(i.barcode) LIKE ?)
        ORDER BY i.name
    `, [`%${q}%`, `%${q}%`]);
    
    let rows = '';
    products.forEach(p => {
        const id = p[0];
        const name = p[2] || '';
        const barcode = p[3] || '';
        const unit = p[4] || '-';
        const buyPrice = p[5] || 0;
        const sellPrice = p[6] || 0;
        const currency = p[7] || 'YER';
        const stock = p[8] || 0;
        
        rows += `<tr>
            <td>${name}</td><td>${barcode}</td><td>${unit}</td>
            <td>${buyPrice.toFixed(2)}</td><td>${sellPrice.toFixed(2)}</td>
            <td>${currency}</td><td>${stock}</td>
            <td>
                <button onclick="viewProduct(${id})">عرض</button>
                <button onclick="editProduct(${id})">تعديل</button>
                <button onclick="deleteProduct(${id})">حذف</button>
            </td>
        </tr>`;
    });
    
    document.querySelector('#productsTable tbody').innerHTML = rows || "<tr><td colspan='8'>لا توجد نتائج</td></tr>";
}

// ======================== دوال الإضافة والتعديل والحذف ========================
function addProduct() {
    const name = document.getElementById('pName').value.trim();
    const barcode = document.getElementById('pBarcode').value.trim();
    const unitId = document.getElementById('pUnit').value || null;
    const categoryId = document.getElementById('pCategory').value || null;
    const buyPrice = parseFloat(document.getElementById('pBuy').value) || 0;
    const sellPrice = parseFloat(document.getElementById('pSell').value) || 0;
    const currency = document.getElementById('pCurrency').value;
    const notes = document.getElementById('pNotes').value.trim();
    
    if (!name) { alert('الرجاء إدخال اسم الصنف'); return; }
    
    const lastCode = query("SELECT MAX(code) FROM items WHERE code LIKE 'P%'")[0];
    let nextNum = 1;
    if (lastCode && lastCode[0]) nextNum = parseInt(lastCode[0].substring(1)) + 1;
    const code = `P${String(nextNum).padStart(4, '0')}`;
    
    run(`INSERT INTO items (code, name, barcode, unit_id, category_id, purchase_cost, sales_price, currency, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [code, name, barcode, unitId, categoryId, buyPrice, sellPrice, currency, notes]);
    
    saveDatabase();
    addLog('إضافة صنف', name);
    productsListPage();
}

function updateProduct(id) {
    const name = document.getElementById('pName').value.trim();
    const barcode = document.getElementById('pBarcode').value.trim();
    const unitId = document.getElementById('pUnit').value || null;
    const categoryId = document.getElementById('pCategory').value || null;
    const buyPrice = parseFloat(document.getElementById('pBuy').value) || 0;
    const sellPrice = parseFloat(document.getElementById('pSell').value) || 0;
    const currency = document.getElementById('pCurrency').value;
    const notes = document.getElementById('pNotes').value.trim();
    
    if (!name) { alert('الرجاء إدخال اسم الصنف'); return; }
    
    run(`UPDATE items SET name=?, barcode=?, unit_id=?, category_id=?, purchase_cost=?, sales_price=?, currency=?, notes=? WHERE id=?`,
        [name, barcode, unitId, categoryId, buyPrice, sellPrice, currency, notes, id]);
    
    saveDatabase();
    addLog('تعديل صنف', name);
    productsListPage();
}

function deleteProduct(id) {
    const usedInSales = query('SELECT COUNT(*) FROM sales_invoice_lines WHERE item_id = ?', [id])[0][0];
    const usedInPurchases = query('SELECT COUNT(*) FROM purchase_invoice_lines WHERE item_id = ?', [id])[0][0];
    
    if (usedInSales > 0 || usedInPurchases > 0) {
        alert('لا يمكن حذف الصنف لأنه مستخدم في فواتير.');
        return;
    }
    
    if (!confirm('هل تريد حذف الصنف؟')) return;
    
    const product = query('SELECT name FROM items WHERE id = ?', [id])[0];
    if (product) addLog('حذف صنف', product[0]);
    
    run('UPDATE items SET is_active = 0 WHERE id = ?', [id]);
    saveDatabase();
    productsListPage();
}

// ======================== دوال العرض والتعديل ========================
function viewProduct(id) {
    const p = query(`
        SELECT i.name, i.barcode, u.name, c.name, i.purchase_cost, i.sales_price, i.currency, i.notes, i.current_stock
        FROM items i
        LEFT JOIN units u ON i.unit_id = u.id
        LEFT JOIN item_categories c ON i.category_id = c.id
        WHERE i.id = ?
    `, [id])[0];
    
    if (!p) { alert('الصنف غير موجود'); return; }
    
    content.innerHTML = `
        <div class="card">
            <h2>بطاقة الصنف</h2>
            <p><strong>الاسم:</strong> ${p[0]}</p>
            <p><strong>الباركود:</strong> ${p[1] || '-'}</p>
            <p><strong>الوحدة:</strong> ${p[2] || '-'}</p>
            <p><strong>الفئة:</strong> ${p[3] || '-'}</p>
            <p><strong>سعر الشراء:</strong> ${p[4].toFixed(2)}</p>
            <p><strong>سعر البيع:</strong> ${p[5].toFixed(2)}</p>
            <p><strong>العملة:</strong> ${p[6]}</p>
            <p><strong>المخزون الحالي:</strong> ${p[8]}</p>
            <p><strong>ملاحظات:</strong> ${p[7] || '-'}</p>
        </div>
        <div class="card">
            <button onclick="editProduct(${id})">تعديل</button>
            <button onclick="productsListPage()">رجوع</button>
        </div>
    `;
}

function editProduct(id) {
    const p = query(`SELECT name, barcode, unit_id, category_id, purchase_cost, sales_price, currency, notes FROM items WHERE id = ?`, [id])[0];
    if (!p) { alert('الصنف غير موجود'); return; }
    
    const units = query('SELECT id, name FROM units ORDER BY name');
    const categories = query('SELECT id, name FROM item_categories ORDER BY name');
    
    let unitOptions = '<option value="">اختر الوحدة</option>';
    units.forEach(u => unitOptions += `<option value="${u[0]}" ${u[0] == p[2] ? 'selected' : ''}>${u[1]}</option>`);
    
    let categoryOptions = '<option value="">اختر الفئة</option>';
    categories.forEach(c => categoryOptions += `<option value="${c[0]}" ${c[0] == p[3] ? 'selected' : ''}>${c[1]}</option>`);
    
    content.innerHTML = `
        <div class="card">
            <h3>تعديل الصنف</h3>
            <label>اسم الصنف</label><input id="pName" value="${p[0]}">
            <label>الباركود</label><input id="pBarcode" value="${p[1] || ''}">
            <label>الوحدة</label><select id="pUnit">${unitOptions}</select>
            <label>الفئة</label><select id="pCategory">${categoryOptions}</select>
            <label>سعر الشراء</label><input id="pBuy" type="number" step="0.01" value="${p[4]}">
            <label>سعر البيع</label><input id="pSell" type="number" step="0.01" value="${p[5]}">
            <label>العملة</label>
            <select id="pCurrency">
                <option value="YER" ${p[6]=='YER'?'selected':''}>ريال يمني</option>
                <option value="USD" ${p[6]=='USD'?'selected':''}>دولار</option>
                <option value="SAR" ${p[6]=='SAR'?'selected':''}>ريال سعودي</option>
            </select>
            <label>ملاحظات</label><textarea id="pNotes">${p[7] || ''}</textarea>
            <br>
            <button onclick="updateProduct(${id})">حفظ</button>
            <button onclick="productsListPage()">إلغاء</button>
        </div>
    `;
}

// تعريض الدوال
window.initProducts = initProducts;
window.productsPage = productsPage;
window.newProductPage = newProductPage;
window.productsListPage = productsListPage;
window.addProduct = addProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.viewProduct = viewProduct;
window.editProduct = editProduct;
window.searchProducts = searchProducts;
