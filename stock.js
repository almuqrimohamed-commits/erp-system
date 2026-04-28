// stock.js - وحدة المخزون المتكاملة (نسخة تشخيصية)
console.log('📊 تحميل وحدة المخزون المتكاملة...');

// ======================== الصفحة الرئيسية للمخزون ========================
function stockPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-warehouse"></i> إدارة المخزون</h2>
            <button onclick="stockList()"><i class="fas fa-list"></i> عرض المخزون الحالي</button>
            <button onclick="stockMovesPage()"><i class="fas fa-history"></i> حركات المخزون</button>
            <button onclick="stockCategoriesPage()"><i class="fas fa-tags"></i> فئات المخزون</button>
            <button onclick="stockValuationPage()"><i class="fas fa-calculator"></i> تقييم المخزون</button>
            <button onclick="lowStockAlertsPage()"><i class="fas fa-exclamation-triangle"></i> تنبيهات النقص</button>
            <button onclick="dashboard()"><i class="fas fa-arrow-right"></i> رجوع</button>
        </div>
    `;
}

// ======================== عرض المخزون الحالي ========================
function stockList() {
    const products = query(`
        SELECT i.id, i.name, u.name as unit, c.name as category, i.current_stock, i.reorder_level
        FROM items i
        LEFT JOIN units u ON i.unit_id = u.id
        LEFT JOIN item_categories c ON i.category_id = c.id
        WHERE i.is_active = 1
        ORDER BY i.name
    `);

    let rows = '';
    products.forEach(p => {
        const id = p[0];
        const name = p[1];
        const unit = p[2] || '-';
        const category = p[3] || '-';
        const stock = p[4] || 0;
        const reorder = p[5] || 0;
        const lowStock = (reorder > 0 && stock < reorder) ? 'style="background-color:#ffe6e6;"' : '';
        
        rows += `<tr ${lowStock}>
            <td>${name}</td>
            <td>${category}</td>
            <td>${unit}</td>
            <td>${stock}</td>
            <td>${reorder}</td>
            <td>
                <button onclick="setReorderLevel(${id})"><i class="fas fa-edit"></i></button>
            </td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h3>المخزون الحالي</h3>
            <input id="stockSearch" placeholder="بحث باسم الصنف" oninput="filterStockList()">
        </div>
        <div class="card">
            <table>
                <thead>
                    <tr><th>الصنف</th><th>الفئة</th><th>الوحدة</th><th>الكمية</th><th>حد الطلب</th><th></th></tr>
                </thead>
                <tbody>
                    ${rows || "<tr><td colspan='6'>لا توجد أصناف</td></tr>"}
                </tbody>
            </table>
            <button onclick="stockPage()">رجوع</button>
        </div>
    `;
}

function filterStockList() {
    const q = document.getElementById('stockSearch').value.toLowerCase();
    const products = query(`
        SELECT i.id, i.name, u.name, c.name, i.current_stock, i.reorder_level
        FROM items i
        LEFT JOIN units u ON i.unit_id = u.id
        LEFT JOIN item_categories c ON i.category_id = c.id
        WHERE i.is_active = 1 AND LOWER(i.name) LIKE ?
        ORDER BY i.name
    `, [`%${q}%`]);

    let rows = '';
    products.forEach(p => {
        const id = p[0];
        const name = p[1];
        const unit = p[2] || '-';
        const category = p[3] || '-';
        const stock = p[4] || 0;
        const reorder = p[5] || 0;
        const lowStock = (reorder > 0 && stock < reorder) ? 'style="background-color:#ffe6e6;"' : '';
        
        rows += `<tr ${lowStock}>
            <td>${name}</td>
            <td>${category}</td>
            <td>${unit}</td>
            <td>${stock}</td>
            <td>${reorder}</td>
            <td><button onclick="setReorderLevel(${id})">تعيين</button></td>
        </tr>`;
    });

    document.querySelector('tbody').innerHTML = rows || "<tr><td colspan='6'>لا توجد نتائج</td></tr>";
}

function setReorderLevel(itemId) {
    const item = query(`SELECT name, reorder_level FROM items WHERE id = ?`, [itemId])[0];
    const current = item[1] || 0;
    const newLevel = prompt(`حد إعادة الطلب لـ "${item[0]}":`, current);
    if (newLevel !== null && !isNaN(parseFloat(newLevel))) {
        run(`UPDATE items SET reorder_level = ? WHERE id = ?`, [parseFloat(newLevel), itemId]);
        saveDatabase();
        stockList();
    }
}

// ======================== حركات المخزون (مع تشخيص مرئي) ========================
function stockMovesPage() {
    const items = query(`SELECT id, name FROM items WHERE is_active = 1 ORDER BY name`);
    const categories = query(`SELECT id, name FROM item_categories ORDER BY name`);
    
    let itemOptions = `<option value="">كل الأصناف</option>`;
    items.forEach(it => itemOptions += `<option value="${it[0]}">${it[1]}</option>`);
    
    let catOptions = `<option value="">كل الفئات</option>`;
    categories.forEach(c => catOptions += `<option value="${c[0]}">${c[1]}</option>`);

    // إحصائيات سريعة
    const purchaseCount = query(`SELECT COUNT(*) FROM purchase_invoices WHERE status = 'Posted'`)[0][0] || 0;
    const salesCount = query(`SELECT COUNT(*) FROM sales_invoices WHERE status = 'Posted'`)[0][0] || 0;

    content.innerHTML = `
        <div class="card">
            <h3>حركات المخزون</h3>
            <p>📊 فواتير شراء مرحلة: ${purchaseCount} | فواتير بيع مرحلة: ${salesCount}</p>
            <label>الصنف</label>
            <select id="moveSearchItem">${itemOptions}</select>
            <label>الفئة</label>
            <select id="moveSearchCategory">${catOptions}</select>
            <label>من تاريخ</label>
            <input type="date" id="moveFromDate">
            <label>إلى تاريخ</label>
            <input type="date" id="moveToDate">
            <label>
                <input type="checkbox" id="includeDrafts"> عرض المسودات أيضاً
            </label>
            <button onclick="filterStockMoves()">عرض</button>
        </div>
        <div class="card">
            <div id="movesTableContainer">جاري التحميل...</div>
            <button onclick="stockPage()">رجوع</button>
        </div>
    `;
    filterStockMoves();
}

function filterStockMoves() {
    const itemId = document.getElementById('moveSearchItem')?.value || '';
    const categoryId = document.getElementById('moveSearchCategory')?.value || '';
    const fromDate = document.getElementById('moveFromDate')?.value || '';
    const toDate = document.getElementById('moveToDate')?.value || '';
    const includeDrafts = document.getElementById('includeDrafts')?.checked || false;

    // --- تشخيص مباشر: عرض محتويات جداول البنود ---
    let debugHtml = '<div style="background:#f0f0f0; padding:10px; margin-bottom:10px;"><strong>🔍 تشخيص:</strong><br>';
    
    // فحص purchase_invoice_lines
    const purLines = query(`SELECT invoice_id, item_id, quantity FROM purchase_invoice_lines LIMIT 5`);
    debugHtml += `📦 بنود مشتريات (أول 5): ${purLines.length} صف<br>`;
    purLines.forEach(l => debugHtml += `&nbsp;&nbsp;- فاتورة ${l[0]}, صنف ${l[1]}, كمية ${l[2]}<br>`);
    
    // فحص sales_invoice_lines
    const salesLines = query(`SELECT invoice_id, item_id, quantity FROM sales_invoice_lines LIMIT 5`);
    debugHtml += `🛒 بنود مبيعات (أول 5): ${salesLines.length} صف<br>`;
    salesLines.forEach(l => debugHtml += `&nbsp;&nbsp;- فاتورة ${l[0]}, صنف ${l[1]}, كمية ${l[2]}<br>`);
    
    debugHtml += '</div>';

    // بناء استعلام الحركات
    const statusCondition = includeDrafts ? "status IN ('Posted', 'Draft')" : "status = 'Posted'";

    let sql = `
        SELECT m.date, i.name, c.name, m.type, m.quantity, m.ref
        FROM (
            SELECT pi.date, pil.item_id, 'شراء' as type, pil.quantity, pi.invoice_number as ref
            FROM purchase_invoices pi
            JOIN purchase_invoice_lines pil ON pi.id = pil.invoice_id
            WHERE pi.${statusCondition}
            UNION ALL
            SELECT pr.date, prl.item_id, 'مرتجع شراء' as type, -prl.quantity, pr.return_number as ref
            FROM purchase_returns pr
            JOIN purchase_return_lines prl ON pr.id = prl.return_id
            WHERE pr.${statusCondition}
            UNION ALL
            SELECT si.date, sil.item_id, 'بيع' as type, -sil.quantity, si.invoice_number as ref
            FROM sales_invoices si
            JOIN sales_invoice_lines sil ON si.id = sil.invoice_id
            WHERE si.${statusCondition}
            UNION ALL
            SELECT sr.date, srl.item_id, 'مرتجع بيع' as type, srl.quantity, sr.return_number as ref
            FROM sales_returns sr
            JOIN sales_return_lines srl ON sr.id = srl.return_id
            WHERE sr.${statusCondition}
        ) m
        JOIN items i ON m.item_id = i.id
        LEFT JOIN item_categories c ON i.category_id = c.id
        WHERE 1=1
    `;
    const params = [];
    if (itemId) { sql += ` AND i.id = ?`; params.push(itemId); }
    if (categoryId) { sql += ` AND i.category_id = ?`; params.push(categoryId); }
    if (fromDate) { sql += ` AND m.date >= ?`; params.push(fromDate); }
    if (toDate) { sql += ` AND m.date <= ?`; params.push(toDate); }
    sql += ` ORDER BY m.date DESC, m.type`;

    const moves = query(sql, params);
    
    let rows = '';
    moves.forEach(m => {
        rows += `<tr>
            <td>${m[0]}</td><td>${m[1]}</td><td>${m[2] || '-'}</td><td>${m[3]}</td>
            <td>${Math.abs(m[4])}</td><td>${m[5]}</td>
        </tr>`;
    });

    document.getElementById('movesTableContainer').innerHTML = debugHtml + `
        <table>
            <tr><th>التاريخ</th><th>الصنف</th><th>الفئة</th><th>النوع</th><th>الكمية</th><th>المرجع</th></tr>
            ${rows || "<tr><td colspan='6'>لا توجد حركات</td></tr>"}
        </table>
    `;
}

// ======================== فئات المخزون ========================
function stockCategoriesPage() {
    const categories = query(`SELECT id, name FROM item_categories ORDER BY name`);
    let rows = '';
    categories.forEach(c => {
        rows += `<tr><td>${c[1]}</td>
            <td>
                <button onclick="editCategory(${c[0]}, '${c[1]}')">تعديل</button>
                <button onclick="deleteCategory(${c[0]})">حذف</button>
            </td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h3>فئات المخزون</h3>
            <button onclick="addCategoryForm()">➕ إضافة فئة</button>
        </div>
        <div class="card">
            <table>
                <tr><th>اسم الفئة</th><th>إجراءات</th></tr>
                ${rows || "<tr><td colspan='2'>لا توجد فئات</td></tr>"}
            </table>
            <button onclick="stockPage()">رجوع</button>
        </div>
    `;
}

function addCategoryForm() {
    const name = prompt('اسم الفئة الجديدة:');
    if (name && name.trim()) {
        run(`INSERT INTO item_categories (name) VALUES (?)`, [name.trim()]);
        saveDatabase();
        stockCategoriesPage();
    }
}

function editCategory(id, oldName) {
    const newName = prompt('تعديل اسم الفئة:', oldName);
    if (newName && newName.trim() && newName !== oldName) {
        run(`UPDATE item_categories SET name = ? WHERE id = ?`, [newName.trim(), id]);
        saveDatabase();
        stockCategoriesPage();
    }
}

function deleteCategory(id) {
    const used = query(`SELECT COUNT(*) FROM items WHERE category_id = ?`, [id])[0][0];
    if (used > 0) {
        alert('لا يمكن حذف الفئة لأنها مستخدمة في أصناف.');
        return;
    }
    if (confirm('حذف الفئة؟')) {
        run(`DELETE FROM item_categories WHERE id = ?`, [id]);
        saveDatabase();
        stockCategoriesPage();
    }
}

// ======================== تقييم المخزون ========================
function stockValuationPage() {
    const items = query(`
        SELECT i.name, c.name, i.current_stock, i.purchase_cost, (i.current_stock * i.purchase_cost) as value
        FROM items i
        LEFT JOIN item_categories c ON i.category_id = c.id
        WHERE i.is_active = 1
        ORDER BY i.name
    `);
    let rows = '';
    let totalValue = 0;
    items.forEach(it => {
        const value = it[4] || 0;
        totalValue += value;
        rows += `<tr><td>${it[0]}</td><td>${it[1] || '-'}</td><td>${it[2]}</td><td>${formatMoney(it[3])}</td><td>${formatMoney(value)}</td></tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h3>تقييم المخزون (بسعر الشراء)</h3>
        </div>
        <div class="card">
            <table>
                <tr><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>تكلفة الوحدة</th><th>القيمة الإجمالية</th></tr>
                ${rows || "<tr><td colspan='5'>لا توجد أصناف</td></tr>"}
                <tr style="font-weight:bold; background:#f0f0f0;"><td colspan="4">الإجمالي</td><td>${formatMoney(totalValue)}</td></tr>
            </table>
            <button onclick="stockPage()">رجوع</button>
        </div>
    `;
}

// ======================== تنبيهات المخزون المنخفض ========================
function lowStockAlertsPage() {
    const lowItems = query(`
        SELECT i.name, i.current_stock, i.reorder_level
        FROM items i
        WHERE i.is_active = 1 AND i.reorder_level > 0 AND i.current_stock < i.reorder_level
        ORDER BY i.name
    `);
    let rows = '';
    lowItems.forEach(it => {
        rows += `<tr><td>${it[0]}</td><td>${it[1]}</td><td>${it[2]}</td></tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h3>تنبيهات المخزون (أقل من الحد الأدنى)</h3>
        </div>
        <div class="card">
            <table>
                <tr><th>الصنف</th><th>الكمية الحالية</th><th>حد إعادة الطلب</th></tr>
                ${rows || "<tr><td colspan='3'>لا توجد تنبيهات</td></tr>"}
            </table>
            <button onclick="stockPage()">رجوع</button>
        </div>
    `;
}

// ======================== دوال مساعدة ========================
function addStockMove(productIndex, type, qty, ref) {}
function getProductStock(productId) {
    const result = query(`SELECT current_stock FROM items WHERE id = ?`, [productId]);
    return result.length ? result[0][0] : 0;
}
function removeStockMovesByRef(ref) {}

// تعريض الدوال
window.stockPage = stockPage;
window.stockList = stockList;
window.stockMovesPage = stockMovesPage;
window.stockCategoriesPage = stockCategoriesPage;
window.stockValuationPage = stockValuationPage;
window.lowStockAlertsPage = lowStockAlertsPage;
window.filterStockList = filterStockList;
window.setReorderLevel = setReorderLevel;
window.filterStockMoves = filterStockMoves;
window.addCategoryForm = addCategoryForm;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.addStockMove = addStockMove;
window.getProductStock = getProductStock;
window.removeStockMovesByRef = removeStockMovesByRef;