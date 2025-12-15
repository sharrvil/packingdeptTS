// Inventory Management System for Technospace Engineers
// Supabase integration with your existing table structure

// Configuration
const CONFIG = {
    // Supabase Configuration (using your existing table)
    SUPABASE_URL: 'https://hfvkwtphtvssvrblovxn.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmdmt3dHBodHZzc3ZyYmxvdnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3OTQ4OTUsImV4cCI6MjA4MTM3MDg5NX0.GHSip8IDZTl3ksZ2jCDzkQ4dBfXGNZqPfMHmuprp8XA',
    
    // Application settings
    ITEMS_PER_PAGE: 15,
    ROWS: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
           'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    RACKS_PER_ROW: 10,
    POSITIONS_PER_RACK: 10
};

// Initialize Supabase client
let supabase;

try {
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    showNotification('Initialization Error', 'Failed to initialize database connection. Please refresh the page.', 'error');
}

// Application State
let inventoryData = [];
let filteredData = [];
let currentPage = 1;
let currentSort = 'partNumber';
let isLoading = true;

// DOM Elements
const elements = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    mainContainer: document.getElementById('mainContainer'),
    partSearch: document.getElementById('partSearch'),
    searchBtn: document.getElementById('searchBtn'),
    rowFilter: document.getElementById('rowFilter'),
    rackFilter: document.getElementById('rackFilter'),
    addPartBtn: document.getElementById('addPartBtn'),
    removePartBtn: document.getElementById('removePartBtn'),
    viewAllBtn: document.getElementById('viewAllBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    sortBy: document.getElementById('sortBy'),
    inventoryTableBody: document.getElementById('inventoryTableBody'),
    resultsCount: document.getElementById('resultsCount'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    rowsContainer: document.getElementById('rowsContainer'),
    addModal: document.getElementById('addModal'),
    removeModal: document.getElementById('removeModal'),
    rackModal: document.getElementById('rackModal'),
    closeAddModal: document.getElementById('closeAddModal'),
    closeRemoveModal: document.getElementById('closeRemoveModal'),
    closeRackModal: document.getElementById('closeRackModal'),
    cancelAdd: document.getElementById('cancelAdd'),
    cancelRemove: document.getElementById('cancelRemove'),
    addPartForm: document.getElementById('addPartForm'),
    removePartForm: document.getElementById('removePartForm'),
    addRow: document.getElementById('addRow'),
    addRack: document.getElementById('addRack'),
    toast: document.getElementById('notificationToast'),
    toastTitle: document.getElementById('toastTitle'),
    toastMessage: document.getElementById('toastMessage'),
    toastIcon: document.getElementById('toastIcon')
};

// Initialize the application
async function initApp() {
    console.log('Initializing application...');
    
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Test Supabase connection first
    const connectionOk = await testSupabaseConnection();
    
    if (!connectionOk) {
        showLoading(false);
        showNotification('Connection Error', 'Could not connect to database. Please check your internet connection.', 'error');
        return;
    }
    
    // Load initial data from Supabase
    await loadInventoryData();
    
    // Populate filter dropdowns
    populateFilters();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize the warehouse visualization
    initWarehouseVisualization();
    
    console.log('Application initialized successfully');
}

// Test Supabase connection
async function testSupabaseConnection() {
    try {
        console.log('Testing Supabase connection...');

        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

        const { error } = await supabase
            .from('inventory')
            .select('*', { head: true, count: 'exact' });

        if (error) {
            console.error('Supabase connection test failed:', error);
            return false;
        }

        console.log('Supabase connection successful');
        return true;
    } catch (err) {
        console.error('Connection test exception:', err);
        return false;
    }
}

// Load inventory data from Supabase
async function loadInventoryData() {
    console.log('Loading inventory data...');
    
    // Show loading overlay
    showLoading(true);
    
    try {
        if (!supabase) {
            throw new Error('Database connection not available');
        }
        
        // Fetch all data from Supabase
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('part_number', { ascending: true });
        
        if (error) {
            throw error;
        }
        
        console.log(`Received ${data ? data.length : 0} items from database`);
        
        // Process the data to match our expected format
        inventoryData = data ? data.map(item => {
            // Parse location to extract row, rack, position
            const location = item.location || '';
            const locationMatch = location.match(/^([A-Z])(\d+)-(\d+)$/);
            
            let row = '';
            let rack = 0;
            let position = 0;
            
            if (locationMatch) {
                row = locationMatch[1];
                rack = parseInt(locationMatch[2]);
                position = parseInt(locationMatch[3]);
            } else {
                // Try to extract if format is different
                const simpleMatch = location.match(/^([A-Z])(\d+)$/);
                if (simpleMatch) {
                    row = simpleMatch[1];
                    rack = parseInt(simpleMatch[2]);
                    position = 1;
                } else if (location) {
                    // Default values if location format is unexpected
                    row = location.charAt(0);
                    rack = 1;
                    position = 1;
                }
            }
            
            return {
                id: item.id,
                partNumber: item.part_number || '',
                tsPartNumber: item.ts_part_number || '',
                quantity: item.quantity || 0,
                location: location,
                row: row,
                rack: rack,
                position: position
            };
        }) : [];
        
        filteredData = [...inventoryData];
        
        console.log('Data processed:', inventoryData.length, 'items');
        
        // Update UI
        updateInventoryTable();
        updateWarehouseVisualization();
        updateResultsCount();
        
        // Show success notification
        showNotification('Data Loaded', `Loaded ${inventoryData.length} inventory items.`, 'success');
    } catch (error) {
        console.error('Error loading inventory data:', error);
        showNotification('Data Load Error', 'Could not load inventory data. Please check your connection.', 'error');
        
        // Fallback to empty data
        inventoryData = [];
        filteredData = [];
        updateInventoryTable();
        updateResultsCount();
    } finally {
        // Hide loading overlay
        showLoading(false);
        console.log('Finished loading data');
    }
}

// Search for a specific part
async function searchPart(partNumber) {
    console.log('Searching for part:', partNumber);
    showLoading(true);
    
    try {
        if (!supabase) {
            throw new Error('Database connection not available');
        }
        
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .ilike('part_number', `%${partNumber}%`)
            .order('location', { ascending: true });
        
        if (error) {
            throw error;
        }
        
        console.log('Search results:', data ? data.length : 0, 'items');
        
        // Process the search results
        inventoryData = data ? data.map(item => {
            const location = item.location || '';
            const locationMatch = location.match(/^([A-Z])(\d+)-(\d+)$/);
            
            let row = '';
            let rack = 0;
            let position = 0;
            
            if (locationMatch) {
                row = locationMatch[1];
                rack = parseInt(locationMatch[2]);
                position = parseInt(locationMatch[3]);
            } else {
                const simpleMatch = location.match(/^([A-Z])(\d+)$/);
                if (simpleMatch) {
                    row = simpleMatch[1];
                    rack = parseInt(simpleMatch[2]);
                    position = 1;
                } else if (location) {
                    row = location.charAt(0);
                    rack = 1;
                    position = 1;
                }
            }
            
            return {
                id: item.id,
                partNumber: item.part_number || '',
                tsPartNumber: item.ts_part_number || '',
                quantity: item.quantity || 0,
                location: location,
                row: row,
                rack: rack,
                position: position
            };
        }) : [];
        
        filteredData = [...inventoryData];
        
        // Update UI
        updateInventoryTable();
        updateResultsCount();
        
        if (inventoryData.length === 0) {
            showNotification('No Results', `No parts found with number: ${partNumber}`, 'info');
        } else {
            showNotification('Search Results', `Found ${inventoryData.length} location(s) for part: ${partNumber}`, 'success');
        }
    } catch (error) {
        console.error('Error searching for part:', error);
        showNotification('Search Error', 'Could not search for parts. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Add part to inventory
async function addPartToInventory(partNumber, tsPartNumber, location, quantity) {
    console.log('Adding part:', { partNumber, tsPartNumber, location, quantity });
    
    try {
        if (!supabase) {
            throw new Error('Database connection not available');
        }
        
        // Check if part already exists at this location
        const { data: existingParts, error: searchError } = await supabase
            .from('inventory')
            .select('*')
            .eq('part_number', partNumber)
            .eq('location', location);
        
        if (searchError) {
            throw searchError;
        }
        
        if (existingParts && existingParts.length > 0) {
            // Update existing part quantity
            const existingPart = existingParts[0];
            const newQuantity = (existingPart.quantity || 0) + quantity;
            
            console.log('Updating existing part:', existingPart.id, 'new quantity:', newQuantity);
            
            const { data, error } = await supabase
                .from('inventory')
                .update({ 
                    quantity: newQuantity,
                    ts_part_number: tsPartNumber || existingPart.ts_part_number,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingPart.id)
                .select();
            
            if (error) {
                throw error;
            }
            
            return { 
                success: true, 
                message: `Updated quantity to ${newQuantity} for existing part at ${location}`,
                data: data[0]
            };
        } else {
            // Insert new part
            console.log('Inserting new part');
            
            const { data, error } = await supabase
                .from('inventory')
                .insert([{
                    part_number: partNumber,
                    ts_part_number: tsPartNumber || null,
                    location: location,
                    quantity: quantity,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select();
            
            if (error) {
                throw error;
            }
            
            return { 
                success: true, 
                message: `Added new part to ${location}`,
                data: data[0]
            };
        }
    } catch (error) {
        console.error('Error adding part:', error);
        return { 
            success: false, 
            error: error.message || 'Failed to add part'
        };
    }
}

// Remove part from inventory
async function removePartFromInventory(partNumber, location, quantityToRemove) {
    console.log('Removing part:', { partNumber, location, quantityToRemove });
    
    try {
        if (!supabase) {
            throw new Error('Database connection not available');
        }
        
        // Find the part at the specified location
        const { data: existingParts, error: searchError } = await supabase
            .from('inventory')
            .select('*')
            .eq('part_number', partNumber)
            .eq('location', location);
        
        if (searchError) {
            throw searchError;
        }
        
        if (!existingParts || existingParts.length === 0) {
            return { 
                success: false, 
                error: 'Part not found at the specified location',
                available: 0
            };
        }
        
        const existingPart = existingParts[0];
        const currentQuantity = existingPart.quantity || 0;
        
        // Check if enough quantity is available
        if (currentQuantity < quantityToRemove) {
            return { 
                success: false, 
                error: 'Insufficient quantity',
                available: currentQuantity
            };
        }
        
        const newQuantity = currentQuantity - quantityToRemove;
        
        if (newQuantity === 0) {
            // Remove the entry completely
            console.log('Removing part completely');
            
            const { error } = await supabase
                .from('inventory')
                .delete()
                .eq('id', existingPart.id);
            
            if (error) {
                throw error;
            }
            
            return { 
                success: true, 
                message: 'Part removed completely from inventory',
                removedCompletely: true
            };
        } else {
            // Update the quantity
            console.log('Updating quantity to:', newQuantity);
            
            const { data, error } = await supabase
                .from('inventory')
                .update({ 
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingPart.id)
                .select();
            
            if (error) {
                throw error;
            }
            
            return { 
                success: true, 
                message: `Updated quantity to ${newQuantity}`,
                data: data[0]
            };
        }
    } catch (error) {
        console.error('Error removing part:', error);
        return { 
            success: false, 
            error: error.message || 'Failed to remove part'
        };
    }
}

// Populate filter dropdowns
function populateFilters() {
    console.log('Populating filters...');
    
    // Populate row filter
    elements.rowFilter.innerHTML = '<option value="">All Rows (A-Z)</option>';
    CONFIG.ROWS.forEach(row => {
        elements.rowFilter.innerHTML += `<option value="${row}">Row ${row}</option>`;
    });
    
    // Populate rack filter
    elements.rackFilter.innerHTML = '<option value="">All Racks</option>';
    for (let i = 1; i <= CONFIG.RACKS_PER_ROW; i++) {
        elements.rackFilter.innerHTML += `<option value="${i}">Rack ${i}</option>`;
    }
    
    // Populate add form dropdowns
    elements.addRow.innerHTML = '<option value="">Select Row</option>';
    CONFIG.ROWS.forEach(row => {
        elements.addRow.innerHTML += `<option value="${row}">Row ${row}</option>`;
    });
    
    elements.addRack.innerHTML = '<option value="">Select Rack</option>';
    for (let i = 1; i <= CONFIG.RACKS_PER_ROW; i++) {
        elements.addRack.innerHTML += `<option value="${i}">Rack ${i}</option>`;
    }
}

// Set up event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Search functionality
    elements.searchBtn.addEventListener('click', performSearch);
    elements.partSearch.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Filter changes
    elements.rowFilter.addEventListener('change', applyFilters);
    elements.rackFilter.addEventListener('change', applyFilters);
    
    // Action buttons
    elements.addPartBtn.addEventListener('click', () => showModal(elements.addModal));
    elements.removePartBtn.addEventListener('click', () => showModal(elements.removeModal));
    elements.viewAllBtn.addEventListener('click', viewAllInventory);
    elements.refreshBtn.addEventListener('click', loadInventoryData);
    
    // Modal controls
    elements.closeAddModal.addEventListener('click', () => hideModal(elements.addModal));
    elements.closeRemoveModal.addEventListener('click', () => hideModal(elements.removeModal));
    elements.closeRackModal.addEventListener('click', () => hideModal(elements.rackModal));
    elements.cancelAdd.addEventListener('click', () => hideModal(elements.addModal));
    elements.cancelRemove.addEventListener('click', () => hideModal(elements.removeModal));
    
    // Form submissions
    elements.addPartForm.addEventListener('submit', addPart);
    elements.removePartForm.addEventListener('submit', removePart);
    
    // Sorting
    elements.sortBy.addEventListener('change', (e) => {
        currentSort = e.target.value;
        sortInventoryData();
        updateInventoryTable();
    });
    
    // Pagination
    elements.prevPage.addEventListener('click', goToPrevPage);
    elements.nextPage.addEventListener('click', goToNextPage);
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            hideModal(elements.addModal);
            hideModal(elements.removeModal);
            hideModal(elements.rackModal);
        }
    });
    
    // Real-time validation for remove location
    const removeLocationInput = document.getElementById('removeLocation');
    if (removeLocationInput) {
        removeLocationInput.addEventListener('input', validateRemoveLocation);
    }
    
    console.log('Event listeners set up');
}

// Perform search
async function performSearch() {
    const searchTerm = elements.partSearch.value.trim();
    console.log('Performing search for:', searchTerm);
    
    if (!searchTerm) {
        // If search is empty, load all data
        await loadInventoryData();
    } else {
        // Search for specific part
        await searchPart(searchTerm);
    }
}

// Apply filters
function applyFilters() {
    const selectedRow = elements.rowFilter.value;
    const selectedRack = elements.rackFilter.value;
    
    let dataToFilter = [...inventoryData];
    
    // Apply row filter
    if (selectedRow) {
        dataToFilter = dataToFilter.filter(item => item.row === selectedRow);
    }
    
    // Apply rack filter
    if (selectedRack) {
        dataToFilter = dataToFilter.filter(item => item.rack.toString() === selectedRack);
    }
    
    filteredData = dataToFilter;
    
    // Reset to first page
    currentPage = 1;
    
    // Update UI
    updateInventoryTable();
    updateResultsCount();
}

// View all inventory
async function viewAllInventory() {
    console.log('Viewing all inventory');
    elements.partSearch.value = '';
    elements.rowFilter.value = '';
    elements.rackFilter.value = '';
    await loadInventoryData();
    showNotification('View All', 'Loading all inventory items.', 'info');
}

// Sort inventory data
function sortInventoryData() {
    console.log('Sorting data by:', currentSort);
    
    filteredData.sort((a, b) => {
        switch (currentSort) {
            case 'partNumber':
                return (a.partNumber || '').localeCompare(b.partNumber || '');
            case 'quantity':
                return (b.quantity || 0) - (a.quantity || 0);
            case 'row':
                return (a.row || '').localeCompare(b.row || '') || 
                       (a.rack || 0) - (b.rack || 0) || 
                       (a.position || 0) - (b.position || 0);
            case 'location':
                return (a.location || '').localeCompare(b.location || '');
            default:
                return 0;
        }
    });
}

// Update inventory table
function updateInventoryTable() {
    console.log('Updating table with', filteredData.length, 'items');
    
    const tableBody = elements.inventoryTableBody;
    
    if (!tableBody) {
        console.error('Table body not found');
        return;
    }
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr class="placeholder-row">
                <td colspan="7" class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>No inventory items found matching your criteria.</p>
                </td>
            </tr>
        `;
        updatePagination();
        return;
    }
    
    // Sort data before displaying
    sortInventoryData();
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredData.length / CONFIG.ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + CONFIG.ITEMS_PER_PAGE, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);
    
    // Clear table
    tableBody.innerHTML = '';
    
    // Add rows for current page
    pageData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.partNumber || 'N/A'}</strong></td>
            <td>${item.tsPartNumber || 'No TS Part Number'}</td>
            <td><span class="quantity-badge ${getStockLevelClass(item.quantity)}">${item.quantity || 0}</span></td>
            <td><strong>${item.location || 'N/A'}</strong></td>
            <td>${item.row || 'N/A'}</td>
            <td>${item.rack || 'N/A'}</td>
            <td>${item.position || 'N/A'}</td>
        `;
        tableBody.appendChild(row);
    });
    
    // Update pagination
    updatePagination(totalPages);
}

// Get stock level CSS class
function getStockLevelClass(quantity) {
    if (!quantity || quantity < 10) return 'low-stock';
    if (quantity <= 50) return 'medium-stock';
    return 'high-stock';
}

// Update pagination controls
function updatePagination(totalPages = 1) {
    const hasPrev = currentPage > 1;
    const hasNext = currentPage < totalPages;
    
    elements.prevPage.disabled = !hasPrev;
    elements.nextPage.disabled = !hasNext;
    
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Update results count
    const start = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE + 1;
    const end = Math.min(currentPage * CONFIG.ITEMS_PER_PAGE, filteredData.length);
    elements.resultsCount.textContent = `Showing ${start}-${end} of ${filteredData.length} items`;
}

// Go to previous page
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateInventoryTable();
        scrollToResults();
    }
}

// Go to next page
function goToNextPage() {
    const totalPages = Math.ceil(filteredData.length / CONFIG.ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        updateInventoryTable();
        scrollToResults();
    }
}

// Scroll to results section smoothly
function scrollToResults() {
    const resultsSection = document.querySelector('.results-section');
    if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Initialize warehouse visualization
function initWarehouseVisualization() {
    console.log('Initializing warehouse visualization');
    
    const rowsContainer = elements.rowsContainer;
    if (!rowsContainer) {
        console.error('Rows container not found');
        return;
    }
    
    rowsContainer.innerHTML = '';
    
    // Create visualization for each row
    CONFIG.ROWS.forEach(row => {
        const rowElement = document.createElement('div');
        rowElement.className = 'row';
        rowElement.innerHTML = `
            <div class="row-label">${row}</div>
            <div class="racks-container" id="racks-${row}"></div>
        `;
        rowsContainer.appendChild(rowElement);
    });
    
    updateWarehouseVisualization();
}

// Update warehouse visualization with current data
function updateWarehouseVisualization() {
    console.log('Updating warehouse visualization');
    
    // Calculate stock levels for each rack
    const rackData = {};
    
    // Initialize rack data structure
    CONFIG.ROWS.forEach(row => {
        rackData[row] = {};
        for (let rack = 1; rack <= CONFIG.RACKS_PER_ROW; rack++) {
            rackData[row][rack] = {
                totalQuantity: 0,
                partCount: 0
            };
        }
    });
    
    // Calculate totals from inventory data
    inventoryData.forEach(item => {
        if (item.row && item.rack && rackData[item.row] && rackData[item.row][item.rack]) {
            rackData[item.row][item.rack].totalQuantity += (item.quantity || 0);
            rackData[item.row][item.rack].partCount += 1;
        }
    });
    
    // Update visualization
    CONFIG.ROWS.forEach(row => {
        const racksContainer = document.getElementById(`racks-${row}`);
        if (!racksContainer) return;
        
        racksContainer.innerHTML = '';
        
        for (let rack = 1; rack <= CONFIG.RACKS_PER_ROW; rack++) {
            const rackInfo = rackData[row][rack];
            const totalQuantity = rackInfo.totalQuantity;
            const partCount = rackInfo.partCount;
            
            const rackElement = document.createElement('div');
            rackElement.className = `rack ${getStockLevelClass(totalQuantity)}`;
            rackElement.textContent = `${row}${rack}`;
            rackElement.dataset.row = row;
            rackElement.dataset.rack = rack;
            
            // Add tooltip
            rackElement.title = `Rack ${row}${rack}: ${totalQuantity} total parts across ${partCount} items`;
            
            // Add click event to show rack details
            rackElement.addEventListener('click', () => showRackDetails(row, rack));
            
            racksContainer.appendChild(rackElement);
        }
    });
}

// Show rack details modal
function showRackDetails(row, rack) {
    console.log('Showing rack details:', row, rack);
    
    const rackItems = inventoryData.filter(item => 
        item.row === row && item.rack === parseInt(rack)
    );
    
    const rackModalTitle = document.getElementById('rackModalTitle');
    const rackContents = document.getElementById('rackContents');
    
    if (!rackModalTitle || !rackContents) {
        console.error('Rack modal elements not found');
        return;
    }
    
    if (rackItems.length === 0) {
        rackModalTitle.innerHTML = `<i class="fas fa-box-open"></i> Rack ${row}${rack} - Empty`;
        rackContents.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>This rack is currently empty.</p>
            </div>
        `;
    } else {
        rackModalTitle.innerHTML = `<i class="fas fa-box-open"></i> Rack ${row}${rack} - Contents`;
        
        let contentsHTML = `
            <div class="rack-summary">
                <p><strong>Total Items:</strong> ${rackItems.length}</p>
                <p><strong>Total Quantity:</strong> ${rackItems.reduce((sum, item) => sum + (item.quantity || 0), 0)}</p>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Part Number</th>
                            <th>TS Part Number</th>
                            <th>Location</th>
                            <th>Quantity</th>
                            <th>Position</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        rackItems.sort((a, b) => (a.position || 0) - (b.position || 0)).forEach(item => {
            contentsHTML += `
                <tr>
                    <td><strong>${item.partNumber || 'N/A'}</strong></td>
                    <td>${item.tsPartNumber || 'No TS Part Number'}</td>
                    <td>${item.location || 'N/A'}</td>
                    <td><span class="quantity-badge ${getStockLevelClass(item.quantity)}">${item.quantity || 0}</span></td>
                    <td>${item.position || 'N/A'}</td>
                </tr>
            `;
        });
        
        contentsHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        rackContents.innerHTML = contentsHTML;
    }
    
    showModal(elements.rackModal);
}

// Add part to inventory
async function addPart(e) {
    e.preventDefault();
    console.log('Add part form submitted');
    
    const partNumber = document.getElementById('addPartNumber')?.value.trim();
    const tsPartNumber = document.getElementById('addTsPartNumber')?.value.trim();
    const quantity = parseInt(document.getElementById('addQuantity')?.value);
    const row = document.getElementById('addRow')?.value;
    const rack = parseInt(document.getElementById('addRack')?.value);
    const position = parseInt(document.getElementById('addPosition')?.value);
    
    // Validation
    if (!partNumber || !row || !rack || !position || !quantity) {
        showNotification('Validation Error', 'Please fill in all required fields.', 'error');
        return;
    }
    
    if (isNaN(quantity) || quantity < 1) {
        showNotification('Validation Error', 'Quantity must be at least 1.', 'error');
        return;
    }
    
    if (isNaN(rack) || rack < 1) {
        showNotification('Validation Error', 'Rack number must be at least 1.', 'error');
        return;
    }
    
    if (isNaN(position) || position < 1) {
        showNotification('Validation Error', 'Position must be at least 1.', 'error');
        return;
    }
    
    // Create location string in format A1-2
    const location = `${row}${rack}-${position}`;
    
    // Call Supabase
    showLoading(true);
    const result = await addPartToInventory(partNumber, tsPartNumber, location, quantity);
    showLoading(false);
    
    if (result.success) {
        showNotification('Part Added', `${quantity} units of ${partNumber} added to ${location}.`, 'success');
        
        // Refresh data
        await loadInventoryData();
        
        // Reset form and close modal
        if (elements.addPartForm) {
            elements.addPartForm.reset();
        }
        hideModal(elements.addModal);
    } else {
        showNotification('Error', result.error || 'Failed to add part.', 'error');
    }
}

// Remove part from inventory
async function removePart(e) {
    e.preventDefault();
    console.log('Remove part form submitted');
    
    const partNumber = document.getElementById('removePartNumber')?.value.trim();
    const location = document.getElementById('removeLocation')?.value.trim().toUpperCase();
    const quantityToRemove = parseInt(document.getElementById('removeQuantity')?.value);
    
    // Validation
    if (!partNumber || !location || !quantityToRemove) {
        showNotification('Validation Error', 'Please fill in all required fields.', 'error');
        return;
    }
    
    if (isNaN(quantityToRemove) || quantityToRemove < 1) {
        showNotification('Validation Error', 'Quantity to remove must be at least 1.', 'error');
        return;
    }
    
    // Call Supabase
    showLoading(true);
    const result = await removePartFromInventory(partNumber, location, quantityToRemove);
    showLoading(false);
    
    if (result.success) {
        showNotification('Part Removed', `${quantityToRemove} units of ${partNumber} removed from ${location}.`, 'success');
        
        // Refresh data
        await loadInventoryData();
        
        // Reset form and close modal
        if (elements.removePartForm) {
            elements.removePartForm.reset();
            document.getElementById('currentPartInfo')?.classList.remove('active');
        }
        hideModal(elements.removeModal);
    } else {
        if (result.error === 'Insufficient quantity' && result.available) {
            showNotification('Insufficient Stock', `Only ${result.available} units available at ${location}.`, 'error');
        } else {
            showNotification('Error', result.error || 'Failed to remove part.', 'error');
        }
    }
}

// Validate remove location in real-time
function validateRemoveLocation() {
    const partNumber = document.getElementById('removePartNumber')?.value.trim();
    const location = document.getElementById('removeLocation')?.value.trim().toUpperCase();
    const infoDiv = document.getElementById('currentPartInfo');
    
    if (!partNumber || !location || !infoDiv) {
        infoDiv?.classList.remove('active');
        return;
    }
    
    // Find the part in current inventory
    const part = inventoryData.find(item => 
        item.partNumber === partNumber && item.location === location
    );
    
    if (part) {
        infoDiv.classList.add('active');
        infoDiv.innerHTML = `
            <p><strong>Current Stock:</strong> ${part.quantity || 0} units of ${part.partNumber} at ${location}</p>
            <p><strong>TS Part Number:</strong> ${part.tsPartNumber || 'N/A'}</p>
            <p><strong>Row/Rack/Position:</strong> ${part.row || 'N/A'}/${part.rack || 'N/A'}/${part.position || 'N/A'}</p>
        `;
    } else {
        infoDiv.classList.remove('active');
    }
}

// Update results count
function updateResultsCount() {
    const totalItems = filteredData.length;
    if (elements.resultsCount) {
        elements.resultsCount.textContent = `Showing ${totalItems-1} item${totalItems !== 1 ? 's' : ''}`;
    }
}

// Show modal with animation
function showModal(modal) {
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Hide modal with animation
function hideModal(modal) {
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Show loading overlay
function showLoading(show) {
    console.log('Show loading:', show);
    
    if (show) {
        elements.loadingOverlay.style.display = 'flex';
        elements.loadingOverlay.style.opacity = '1';
        elements.mainContainer.style.opacity = '0.5';
        isLoading = true;
    } else {
        elements.loadingOverlay.style.opacity = '0';
        elements.mainContainer.style.opacity = '1';
        
        setTimeout(() => {
            elements.loadingOverlay.style.display = 'none';
            isLoading = false;
        }, 100);
    }
}

// Show notification toast
function showNotification(title, message, type = 'success') {
    console.log('Showing notification:', title, message, type);
    
    // Set toast styling based on type
    let icon = 'fa-check-circle';
    let borderColor = '#10b981';
    
    if (type === 'error') {
        icon = 'fa-exclamation-circle';
        borderColor = '#ef4444';
    } else if (type === 'info') {
        icon = 'fa-info-circle';
        borderColor = '#3b82f6';
    }
    
    // Update toast content
    elements.toastTitle.textContent = title;
    elements.toastMessage.textContent = message;
    elements.toastIcon.className = `fas ${icon}`;
    elements.toast.style.borderLeftColor = borderColor;
    
    // Show toast
    elements.toast.classList.add('show');
    
    // Hide after 5 seconds
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 5000);
}

// Add error handling for missing DOM elements
function checkRequiredElements() {
    const requiredElements = [
        'loadingOverlay', 'mainContainer', 'partSearch', 'searchBtn',
        'inventoryTableBody', 'resultsCount', 'rowsContainer'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        return false;
    }
    
    return true;
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing app...');
    
    // Check for required elements
    if (!checkRequiredElements()) {
        showNotification('Setup Error', 'Some page elements failed to load. Please refresh.', 'error');
        showLoading(false);
        return;
    }
    
    try {
        await initApp();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showLoading(false);
        showNotification('Initialization Error', 'Failed to initialize the application. Please refresh.', 'error');
    }
});

// Add global error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('Application Error', 'An unexpected error occurred. Please refresh the page.', 'error');

});
