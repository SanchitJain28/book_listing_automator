## Search result page

<div id="site-wrapper">
             
   
   
    <div class="search-results fltrs">
    
    <div class="rwd1">
    <div class="close-tag"><a href="javascript:void(0);">Close</a></div>
    
        <div class="left-column">
          
           
            
<!-- Desktop View -->
<div class="search-criteria"><h2> Refine your Search </h2><h3><strong>Search Within</strong></h3><ul><li class="active"><a href="https://www.bookswagon.com/search-books/9789395185097/filter?sid=0&amp;tab=1">Show All (1)</a></li><li><a href="https://www.bookswagon.com/search-books/9789395185097/title?sid=0&amp;tab=2">By Title (1)</a></li></ul><h3><input type="hidden" id="hdnPR" value="0">By Price</h3><ul><li class="active"><a href="javascript:void(0);">All <span> (1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','PR:4');">Rs.1000 - Rs.2000  <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnDiscount" value="0">By Discount</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Discount:4');">31% - 40% <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnStock" value="0">Availability</h3><ul><li class="active"><a href="javascript:void(0)">All <span> (1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Stock:1');"> In Stock <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnST" value="0">Shipping Time</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','ShippingTime:1');">Within 1 Week <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnSource" value="0">Source</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Source:1');">Indian <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnBinding" value="0">Binding</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Binding:1');">PaperBack <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnLang" value="0">Language</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Language:English');">English <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnPubYear" value="0">Publication Year</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','PubYear:2023');">2023 <span>(1)</span></a></li></ul></div>

<!-- JavaScript variables -->
<script language="javascript" type="text/javascript">
    var search_term = "9789395185097";
    var filter = "filter";
    var pageType = "search";
    var searchType = "books";
    var id_search = "0";
</script>

<!-- TEMPORARY FILTER OPEN BUTTON - For testing only -->

<!-- Mobile Filters HTML (All tabs from desktop view) -->
<div id="mobileFiltersContainer" style="display: none;">
    <!-- Overlay -->
    <div class="darkfilter-overlay" style="display: none;"></div>

    <!-- Mobile Container -->
    <div class="mobile-container" style="display: none;">
        <!-- Header -->
        <div class="headerfilter">
            <h2>Filter</h2>
            <span class="closefilter-btn">×</span>
        </div>

        <!-- Main Layout: Split View -->
        <div class="filter-body">
            <!-- Left Sidebar (Tabs) - All desktop filter types -->
            <ul class="sidebarfilter">

                <li class="sidebarfilter-item active" onclick="openTab(event, 'price')">Price</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'discount')">Discount</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'availability')">Availability</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'shippingTime')">Shipping Time</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'source')">Source</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'binding')">Binding</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'language')">Language</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'pubYear')">Publication Year</li>

            </ul>

            <!-- Right Content Area -->
            <div class="content-area" id="mobileContentArea">
                <!-- Search Within Tab -->


                <!-- Price Tab -->
                <div id="price" class="tab-content active">

                    <label class="item-row">
                        <input type="radio" name="mobilePrice" value="0" id="priceAll" checked="">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="radio" name="mobilePrice" value="4" id="price4">
                        Rs.1000 - Rs.2000 <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Discount Tab -->
                <div id="discount" class="tab-content">

                    <label class="item-row">
                        <input type="radio" name="mobileDiscount" value="0" id="discountAll" checked="">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="radio" name="mobileDiscount" value="4" id="discount4">
                        31% - 40% <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Availability Tab -->
                <div id="availability" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileStock" value="0" id="stockAll" checked="" onclick="handleAllCheckbox(this, 'mobileStock')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileStock" value="1" id="stockInStock">
                        In Stock <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Shipping Time Tab -->
                <div id="shippingTime" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileShippingTime" value="0" id="stAll" checked="" onclick="handleAllCheckbox(this, 'mobileShippingTime')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileShippingTime" value="1" id="st1">
                        Within 1 Week <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Source Tab -->
                <div id="source" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileSource" value="0" id="sourceAll" checked="" onclick="handleAllCheckbox(this, 'mobileSource')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileSource" value="1" id="sourceIndian">
                        Indian <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Binding Tab -->
                <div id="binding" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileBinding" value="0" id="bindingAll" checked="" onclick="handleAllCheckbox(this, 'mobileBinding')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileBinding" value="1" id="bindingPaperback">
                        Paperback <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Language Tab -->
                <div id="language" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileLanguage" value="0" id="langAll" checked="" onclick="handleAllCheckbox(this, 'mobileLanguage')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileLanguage" value="English" id="langEnglish">
                        English <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Publication Year Tab -->
                <div id="pubYear" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobilePubYear" value="0" id="pubYearAll" checked="" onclick="handleAllCheckbox(this, 'mobilePubYear')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobilePubYear" value="2023" id="pubYear2023">
                        2023 <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Prize Tab -->
                <div id="prize" class="tab-content">

                </div>
            </div>
        </div>

        <!-- Footer buttons - Always visible -->
        <div class="footerfilter">
            <button class="clear-btn" type="button" onclick="MobileFilters.clearAll(); return false;">Clear Filters</button>
            <button class="apply-btn" type="button" onclick="MobileFilters.apply(); return false;">Apply Filters</button>
        </div>
    </div>

</div>

<!-- Font Awesome for icons -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<!-- Mobile Filters CSS -->
<style type="text/css">
    /* ========== MOBILE FILTERS CSS - HORIZONTAL LAYOUT ========== */
    #mobileFiltersContainer {
        display: none;
    }

    .cover .cover-discount-tag{
                width: 38px!important;
  height: 56px!important;

  background: url(/images/staticimages/offer.svg)!important;
    background-repeat: no-repeat!important;
    background-size:100% auto!important;
    line-height:34px!important;
    }
    .cover .cover-discount-tag::before, .cover .cover-discount-tag1::before{display:none;}

    /* Mobile Container */
.mobile-container {
    width: 100%;
    height: 80vh;
    background-color: white;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    position: fixed;
    bottom: 55px;
    left: 0px;
    z-index: 100001;
    border-radius: 12px 12px 0 0;
    display: flex;
    flex-direction: column;
}

    /* Overlay */
    .darkfilter-overlay {
        width: 100%;
        position: fixed;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        left: 0;
        top: 0;
        z-index: 100000;
    }

    /* Header */
    .headerfilter {
        padding: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        background: white;
        flex-shrink: 0;
            border-radius: 5px 5px 0 0;
    }

        .headerfilter h2 {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin: 0;
        }

    .closefilter-btn {
        font-size: 24px;
        color: #888;
        cursor: pointer;
        line-height: 1;
    }

    /* Main Layout: Split View */
    .filter-body {
        display: flex;
        flex: 1;
        overflow: hidden;
        height: calc(100% - 120px);
    }

    /* Left Sidebar (Tabs) */
    .sidebarfilter {
        width: 35%;
        background-color: #f8f9fa;
        border-right: 1px solid #eee;
        list-style: none;
        padding: 0px;
        margin: 0;
        overflow-y: auto;
    }

    .sidebarfilter-item {
        padding: 15px 10px;
        font-size: 13px;
        color: #555;
        cursor: pointer;
        border-left: 4px solid transparent;
        transition: all 0.2s;
    }

        .sidebarfilter-item.active {
            background-color: white;
            border-left-color: #ff3f3f;
            font-weight: 600;
            color: #000;
        }

    /* Right Content Area */
    .content-area {
        width: 65%;
        background-color: white;
        overflow-y: auto;
        padding: 10px 0 70px 0;
    }

    /* Tab Content */
    .tab-content {
        display: none;
        animation: fadeIn 0.3s ease;
    }

        .tab-content.active {
            display: block;
        }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(5px);
        }

        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Item Styling */
    .item-row {
        display: flex;
        align-items: center;
        padding: 12px 15px;
        font-size: 13px;
        color: #333;
        cursor: pointer;
        border-bottom: 1px solid #f0f0f0;
    }

        .item-row:hover {
            background-color: #fafafa;
        }

        .item-row input[type="checkbox"],
        .item-row input[type="radio"] {
            margin-right: 12px;
            accent-color: #ff3f3f;
            transform: scale(1.1);
        }

            .item-row input[type="radio"]:checked + .item-row,
            .item-row input[type="checkbox"]:checked + .item-row {
                font-weight: 600;
                color: #ff3f3f;
            }

    .count {
        color: #888;
        margin-left: auto;
        font-size: 12px;
    }

    .readmore-link {
        display: block;
        padding: 10px 15px;
        color: #0066c0;
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
    }

        .readmore-link:hover {
            text-decoration: underline;
        }

    /* Footer - Fixed at bottom */
    .footerfilter {
padding: 15px;
    border-top: 1px solid #eee;
    background: white;
    position: fixed;
    bottom: 0;
    width: 100%;
    }

    .clear-btn {
        flex: 1;
        background-color: #6c757d;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
         width:48%;
    }



    .apply-btn {
        flex: 1;
        background-color: #ff3f3f;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(255, 63, 63, 0.3);
        transition: background-color 0.2s;
        width:48%;
    }

    .clear-btn:hover {
        background-color: #5a6268;
    }

    .apply-btn:hover {
        background-color: #e63636;
    }

    .clear-btn:active, .apply-btn:active {
        transform: translateY(1px);
    }

    /* Floating filter button */
    .mobile-filter-button {
        display: none;
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
    }

        .mobile-filter-button button {
            background: #ff3f3f;
            color: white;
            border: none;
            border-radius: 50px;
            padding: 15px 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(255, 63, 63, 0.3);
            transition: all 0.2s;
        }

            .mobile-filter-button button:hover {
                background: #e63946;
                transform: translateY(-2px);
                box-shadow: 0 6px 15px rgba(255, 63, 63, 0.4);
            }

            .mobile-filter-button button i {
                font-size: 18px;
            }

    .filter-count-badge {
        background: white;
        color: #ff3f3f;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 5px;
        font-weight: bold;
    }

    /* TEMPORARY BUTTON STYLES */
    #tempMobileFilterButton {
        display: block !important;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% {
            transform: scale(1);
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        }

        50% {
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(76, 175, 80, 0.6);
        }

        100% {
            transform: scale(1);
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        }
    }

    /* Hide on desktop */
    @media (min-width: 992px) {
        #mobileFiltersContainer {
            display: none !important;
        }

        #tempMobileFilterButton {
            display: none !important;
        }
    }

    /* Show on mobile */
    @media (max-width: 991px) {
        .mobile-filter-button {
            display: block !important;
        }

        /* Hide desktop filters on mobile */
        .search-criteria {
            display: none !important;
        }

        #tempMobileFilterButton {
            display: block !important;
        }
    }

    /* Scrollbar styling */
    .content-area::-webkit-scrollbar {
        width: 4px;
    }

    .content-area::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    .content-area::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 2px;
    }

    .sidebarfilter::-webkit-scrollbar {
        width: 3px;
    }

    .sidebarfilter::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    .sidebarfilter::-webkit-scrollbar-thumb {
        background: #ccc;
    }

    @media only screen and (max-width:768px){
          .list-view-books .price-attrib, .list-view-books .action {
        display: block !important;
    }
      #site-wrapper .list-view-books .attributes, .list, .right-border1, .order-info, .available-stock, .btn-black {
        display: none !important;
    }
      .list-view-books .cover{border-radius: 10px;
    border: 1px solid #f1f0f0;
   }
           .cattogglelayout .list-view-books{width:100%!important;}
        #listSearchResult.cattogglelayout .list-view-books .cover img{height:160px!important}
        #listSearchResult.cattogglelayout .list-view-books .action {
    display: inline-block !important;
    float: left !important;
    width: 200px !important;
    padding-left:15px!important;
  }
         #listSearchResult.cattogglelayout .title{text-align:left!important;}
        .cattogglelayout .product-summary{
            padding-left: 15px !important;
width: calc(100% - 100px);
    text-align: left !important;
}
.cattogglelayout .sell, .cattogglelayout .action, .cattogglelayout .author-publisher{text-align:left!important}
.cattogglelayout .cover{
    width: 100px !important;
    float: left;
}
        .list-view-books .cover img{
                        width: 100%;
    height: 235px !important;
    object-fit: contain;
    border-radius: 6px;
        }
    }
</style>

<!-- Mobile Filters JavaScript -->
<script type="text/javascript">
    // ========== MOBILE FILTERS JAVASCRIPT ==========
    var MobileFilters = {
        state: {
            searchWithin: 'filter',
            price: '0',
            discount: '0',
            stock: '0',
            shippingTime: '0',
            source: '0',
            binding: '0',
            language: '0',
            pubYear: '0',
            prize: '0'
        },

        init: function () {
            console.log("MobileFilters initialized for RefineSearch");

            if (window.innerWidth > 991) return;

            var container = document.getElementById('mobileFiltersContainer');
            if (container) {
                container.style.display = 'block';
            }

            var button = document.getElementById('mobileFilterButton');
            if (button) {
                button.style.display = 'block';
            }

            this.loadInitialState();
            this.setupEventListeners();
            this.updateFilterCount();
            this.switchTab('price');
            //this.switchTab('searchWithin');
        },

        loadInitialState: function () {
            try {
                // Load from hidden fields
                var hdnPR = document.getElementById('hdnPR');
                var hdnDiscount = document.getElementById('hdnDiscount');
                var hdnStock = document.getElementById('hdnStock');
                var hdnST = document.getElementById('hdnST');
                var hdnSource = document.getElementById('hdnSource');
                var hdnBinding = document.getElementById('hdnBinding');
                var hdnLang = document.getElementById('hdnLang');
                var hdnPubYear = document.getElementById('hdnPubYear');
                var hdnPrize = document.getElementById('hdnPrize');

                if (hdnPR) this.state.price = hdnPR.value || '0';
                if (hdnDiscount) this.state.discount = hdnDiscount.value || '0';
                if (hdnStock) this.state.stock = hdnStock.value || '0';
                if (hdnST) this.state.shippingTime = hdnST.value || '0';
                if (hdnSource) this.state.source = hdnSource.value || '0';
                if (hdnBinding) this.state.binding = hdnBinding.value || '0';
                if (hdnLang) this.state.language = hdnLang.value || '0';
                if (hdnPubYear) this.state.pubYear = hdnPubYear.value || '0';
                if (hdnPrize) this.state.prize = hdnPrize.value || '0';

                console.log("Loaded initial state:", this.state);

                // Update UI with loaded state
                this.updateUIFromState();
            } catch (e) {
                console.log("Could not load initial state:", e);
            }
        },

        setupEventListeners: function () {
            var self = this;

            var container = document.getElementById('mobileFiltersContainer');
            if (container) {
                container.addEventListener('change', function (e) {
                    if (e.target.type === 'checkbox' || e.target.type === 'radio') {
                        self.handleFilterChange(e.target);
                    }
                });
            }

            var closeBtn = document.querySelector('.closefilter-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.hide();
                });
            }

            var overlay = document.querySelector('.darkfilter-overlay');
            if (overlay) {
                overlay.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.hide();
                });
            }

            var filterBtn = document.querySelector('#mobileFilterButton button');
            if (filterBtn) {
                filterBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.show();
                });
            }

            var sidebarItems = document.querySelectorAll('.sidebarfilter-item');
            for (var i = 0; i < sidebarItems.length; i++) {
                var item = sidebarItems[i];
                item.addEventListener('click', function (e) {
                    e.preventDefault();
                    var onclickAttr = this.getAttribute('onclick');
                    if (onclickAttr) {
                        var match = onclickAttr.match(/'([^']+)'/);
                        if (match && match[1]) {
                            self.switchTab(match[1]);
                        }
                    }
                });
            }
        },

        switchTab: function (tabName) {
            var sidebarItems = document.querySelectorAll('.sidebarfilter-item');
            for (var i = 0; i < sidebarItems.length; i++) {
                sidebarItems[i].classList.remove('active');
            }

            var activeTab = null;
            for (var i = 0; i < sidebarItems.length; i++) {
                if (sidebarItems[i].getAttribute('onclick') && sidebarItems[i].getAttribute('onclick').indexOf(tabName) > -1) {
                    activeTab = sidebarItems[i];
                    break;
                }
            }
            if (activeTab) {
                activeTab.classList.add('active');
            }

            var tabContents = document.querySelectorAll('.tab-content');
            for (var i = 0; i < tabContents.length; i++) {
                tabContents[i].classList.remove('active');
            }

            var activeContent = document.getElementById(tabName);
            if (activeContent) {
                activeContent.classList.add('active');
            }
        },

        handleFilterChange: function (input) {
            var filterValue = input.value;
            var isChecked = input.checked;
            var filterType = '';
            var inputName = input.name;

            if (inputName === 'mobileSearchWithin') {
                filterType = 'searchWithin';
                if (isChecked) {
                    this.state.searchWithin = filterValue;
                }
            }
            else if (inputName === 'mobilePrice') {
                filterType = 'price';
                if (isChecked) {
                    this.state.price = filterValue;
                }
            }
            else if (inputName === 'mobileDiscount') {
                filterType = 'discount';
                if (isChecked) {
                    this.state.discount = filterValue;
                }
            }
            else if (inputName === 'mobileStock') {
                filterType = 'stock';
                this.updateCheckboxFilter('stock', filterValue, isChecked, input);
            }
            else if (inputName === 'mobileShippingTime') {
                filterType = 'shippingTime';
                this.updateCheckboxFilter('shippingTime', filterValue, isChecked, input);
            }
            else if (inputName === 'mobileSource') {
                filterType = 'source';
                this.updateCheckboxFilter('source', filterValue, isChecked, input);
            }
            else if (inputName === 'mobileBinding') {
                filterType = 'binding';
                this.updateCheckboxFilter('binding', filterValue, isChecked, input);
            }
            else if (inputName === 'mobileLanguage') {
                filterType = 'language';
                this.updateCheckboxFilter('language', filterValue, isChecked, input);
            }
            else if (inputName === 'mobilePubYear') {
                filterType = 'pubYear';
                this.updateCheckboxFilter('pubYear', filterValue, isChecked, input);
            }
            else if (inputName === 'mobilePrize') {
                filterType = 'prize';
                this.updateCheckboxFilter('prize', filterValue, isChecked, input);
            }

            console.log("Filter changed:", filterType, filterValue, isChecked);
            this.updateFilterCount();
        },

        updateCheckboxFilter: function (filterType, value, isChecked, input) {
            // Handle "All" option
            if (value === '0') {
                if (isChecked) {
                    // Uncheck all other checkboxes in this group
                    var checkboxes = document.querySelectorAll('input[name="mobile' +
                        filterType.charAt(0).toUpperCase() + filterType.slice(1) + '"]:not([value="0"])');
                    for (var i = 0; i < checkboxes.length; i++) {
                        checkboxes[i].checked = false;
                    }
                    this.state[filterType] = '0';
                }
                return;
            }

            // If any non-all checkbox is checked, uncheck the "All" checkbox
            if (isChecked) {
                var allCheckbox = document.querySelector('input[name="mobile' +
                    filterType.charAt(0).toUpperCase() + filterType.slice(1) + '"][value="0"]');
                if (allCheckbox && allCheckbox.checked) {
                    allCheckbox.checked = false;
                }
            }

            var currentValues = this.state[filterType];
            var valuesArray = currentValues === '0' ? [] : currentValues.split(',');

            if (isChecked && valuesArray.indexOf(value) === -1) {
                valuesArray.push(value);
            } else if (!isChecked && valuesArray.indexOf(value) !== -1) {
                valuesArray = valuesArray.filter(function (v) { return v !== value; });
            }

            // If no checkboxes are checked, set to '0'
            if (valuesArray.length === 0) {
                this.state[filterType] = '0';
                // Check the "All" checkbox
                var allCheckbox = document.querySelector('input[name="mobile' +
                    filterType.charAt(0).toUpperCase() + filterType.slice(1) + '"][value="0"]');
                if (allCheckbox) {
                    allCheckbox.checked = true;
                }
            } else {
                this.state[filterType] = valuesArray.join(',');
            }
        },

        show: function () {
            console.log("Showing mobile filter panel");
            var mobileContainer = document.querySelector('.mobile-container');
            var overlay = document.querySelector('.darkfilter-overlay');

            if (mobileContainer) {
                mobileContainer.style.display = 'flex';
            }
            if (overlay) {
                overlay.style.display = 'block';
            }
            document.body.style.overflow = 'hidden';

            // Reload state from hidden fields to ensure we have latest
            this.loadInitialState();
        },

        hide: function () {
            console.log("Hiding mobile filter panel");
            var mobileContainer = document.querySelector('.mobile-container');
            var overlay = document.querySelector('.darkfilter-overlay');

            if (mobileContainer) {
                mobileContainer.style.display = 'none';
            }
            if (overlay) {
                overlay.style.display = 'none';
            }
            document.body.style.overflow = '';
        },

        updateUIFromState: function () {
            // Update search within radio
            if (this.state.searchWithin) {
                var searchRadios = document.querySelectorAll('input[name="mobileSearchWithin"]');
                for (var i = 0; i < searchRadios.length; i++) {
                    if (searchRadios[i].value === this.state.searchWithin) {
                        searchRadios[i].checked = true;
                    } else if (this.state.searchWithin === 'filter' && searchRadios[i].value === 'filter') {
                        searchRadios[i].checked = true;
                    }
                }
            }

            // Update price radio
            if (this.state.price !== '0') {
                var priceRadios = document.querySelectorAll('input[name="mobilePrice"]');
                for (var i = 0; i < priceRadios.length; i++) {
                    if (priceRadios[i].value === this.state.price) {
                        priceRadios[i].checked = true;
                    }
                }
            } else {
                var priceAll = document.querySelector('input[name="mobilePrice"][value="0"]');
                if (priceAll) priceAll.checked = true;
            }

            // Update discount radio
            if (this.state.discount !== '0') {
                var discountRadios = document.querySelectorAll('input[name="mobileDiscount"]');
                for (var i = 0; i < discountRadios.length; i++) {
                    if (discountRadios[i].value === this.state.discount) {
                        discountRadios[i].checked = true;
                    }
                }
            } else {
                var discountAll = document.querySelector('input[name="mobileDiscount"][value="0"]');
                if (discountAll) discountAll.checked = true;
            }

            // Update checkbox filters
            this.updateCheckboxGroup('stock', this.state.stock);
            this.updateCheckboxGroup('shippingTime', this.state.shippingTime);
            this.updateCheckboxGroup('source', this.state.source);
            this.updateCheckboxGroup('binding', this.state.binding);
            this.updateCheckboxGroup('language', this.state.language);
            this.updateCheckboxGroup('pubYear', this.state.pubYear);
            this.updateCheckboxGroup('prize', this.state.prize);
        },

        updateCheckboxGroup: function (filterType, valueString) {
            var values = valueString === '0' ? [] : valueString.split(',');
            var checkboxes = document.querySelectorAll('input[name="mobile' +
                filterType.charAt(0).toUpperCase() + filterType.slice(1) + '"]');

            for (var i = 0; i < checkboxes.length; i++) {
                var cb = checkboxes[i];
                if (cb.value === '0') {
                    cb.checked = (values.length === 0);
                } else {
                    cb.checked = (values.indexOf(cb.value) !== -1);
                }
            }
        },

        apply: function () {
            console.log("Applying mobile filters:", this.state);

            // Update hidden fields with current state
            if (document.getElementById('hdnPR')) {
                document.getElementById('hdnPR').value = this.state.price;
            }
            if (document.getElementById('hdnDiscount')) {
                document.getElementById('hdnDiscount').value = this.state.discount;
            }
            if (document.getElementById('hdnStock')) {
                document.getElementById('hdnStock').value = this.state.stock;
            }
            if (document.getElementById('hdnST')) {
                document.getElementById('hdnST').value = this.state.shippingTime;
            }
            if (document.getElementById('hdnSource')) {
                document.getElementById('hdnSource').value = this.state.source;
            }
            if (document.getElementById('hdnBinding')) {
                document.getElementById('hdnBinding').value = this.state.binding;
            }
            if (document.getElementById('hdnLang')) {
                document.getElementById('hdnLang').value = this.state.language;
            }
            if (document.getElementById('hdnPubYear')) {
                document.getElementById('hdnPubYear').value = this.state.pubYear;
            }
            if (document.getElementById('hdnPrize')) {
                document.getElementById('hdnPrize').value = this.state.prize;
            }

            // Update filter based on search within
            var newFilter = this.state.searchWithin;
            if (newFilter && newFilter !== 'filter' && newFilter !== 'filter') {
                // Redirect to the appropriate search within URL
                var baseUrl = '';
                if (searchType === 'books') {
                    baseUrl = '/search-books/';
                } else if (searchType === 'ebooks') {
                    baseUrl = '/search-ebooks/';
                } else {
                    baseUrl = '/search/';
                }

                var tabId = '1';
                if (newFilter === 'title') tabId = '2';
                else if (newFilter === 'author') tabId = '3';
                else if (newFilter === 'publisher') tabId = '4';

                var url = baseUrl + encodeURIComponent(search_term) + '/' + newFilter + '?sid=' + id_search + '&tab=' + tabId;
                window.location.href = url;
                return;
            }

            // Call the existing GetSearchCriteria function
            if (typeof GetSearchCriteria === 'function') {
                GetSearchCriteria(searchType || 'books', '');
            } else {
                console.error("GetSearchCriteria function not found");
                // Fallback - reload page with updated filters
                location.reload();
            }

            this.hide();
        },

        clearAll: function () {
            console.log("Clearing all mobile filters");

            this.state = {
                searchWithin: 'filter',
                price: '0',
                discount: '0',
                stock: '0',
                shippingTime: '0',
                source: '0',
                binding: '0',
                language: '0',
                pubYear: '0',
                prize: '0'
            };

            // Update UI
            this.updateUIFromState();
            this.updateFilterCount();

            // Show success message
            alert('All filters cleared');
        },

        updateFilterCount: function () {
            var count = 0;

            if (this.state.searchWithin !== 'filter' && this.state.searchWithin !== '*') count++;
            if (this.state.price !== '0') count++;
            if (this.state.discount !== '0') count++;
            if (this.state.stock !== '0') count += this.state.stock.split(',').length;
            if (this.state.shippingTime !== '0') count += this.state.shippingTime.split(',').length;
            if (this.state.source !== '0') count += this.state.source.split(',').length;
            if (this.state.binding !== '0') count += this.state.binding.split(',').length;
            if (this.state.language !== '0') count += this.state.language.split(',').length;
            if (this.state.pubYear !== '0') count += this.state.pubYear.split(',').length;
            if (this.state.prize !== '0') count += this.state.prize.split(',').length;

            var badge = document.getElementById('mobileFilterCount');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }

            return count;
        }
    };

    // Helper function for "All" checkbox handling
    function handleAllCheckbox(allCheckbox, groupName) {
        if (allCheckbox.checked) {
            var checkboxes = document.querySelectorAll('input[name="' + groupName + '"]:not([value="0"])');
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].checked = false;
            }
            // Update state
            MobileFilters.state[groupName.replace('mobile', '').toLowerCase()] = '0';
        }
        MobileFilters.updateFilterCount();
    }

    // Helper functions for "Show More" links
    function showMoreLanguages() {
        document.getElementById('moreLanguages').style.display = 'block';
        event.target.style.display = 'none';
    }

    function showMorePubYears() {
        document.getElementById('morePubYears').style.display = 'block';
        event.target.style.display = 'none';
    }

    function showMorePrizes() {
        document.getElementById('morePrizes').style.display = 'block';
        event.target.style.display = 'none';
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        if (window.innerWidth <= 991) {
            MobileFilters.init();
        } else {
            var mobileFilterButton = document.getElementById('mobileFilterButton');
            if (mobileFilterButton) {
                mobileFilterButton.style.display = 'none';
            }
        }

        window.addEventListener('resize', function () {
            if (window.innerWidth <= 991) {
                MobileFilters.init();
            } else {
                MobileFilters.hide();
                var mobileFilterButton = document.getElementById('mobileFilterButton');
                if (mobileFilterButton) {
                    mobileFilterButton.style.display = 'none';
                }
            }
        });
    });

    // Helper function for onclick handlers
    function openTab(evt, tabName) {
        var tabContent = document.getElementsByClassName("tab-content");
        for (var i = 0; i < tabContent.length; i++) {
            tabContent[i].classList.remove("active");
        }

        var sidebarItems = document.getElementsByClassName("sidebarfilter-item");
        for (var i = 0; i < sidebarItems.length; i++) {
            sidebarItems[i].classList.remove("active");
        }

        var tabElement = document.getElementById(tabName);
        if (tabElement) {
            tabElement.classList.add("active");
        }
        evt.currentTarget.classList.add("active");
    }
</script>

<!-- Your existing JavaScript functions remain untouched -->
<script type="text/javascript">
    function GetMoreLanguage() {
        document.getElementById("divLangMore").style.display = 'inline';
        document.getElementById("liMoreLess").innerHTML = "<a class=\"upArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:LessLanguages()\">Less</a>";
    }
    function LessLanguages() {
        document.getElementById("divLangMore").style.display = 'none';
        document.getElementById("liMoreLess").innerHTML = "<a class=\"downArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:GetMoreLanguage()\">More</a>";
    }
    function GetMorePubYear() {
        document.getElementById("divPubMore").style.display = 'inline';
        document.getElementById("liPubMoreLess").innerHTML = "<a class=\"upArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:LessPubYear()\">Less</a>";
    }
    function LessPubYear() {
        document.getElementById("divPubMore").style.display = 'none';
        document.getElementById("liPubMoreLess").innerHTML = "<a class=\"downArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:GetMorePubYear()\">More</a>";
    }
    function GetMorePrize() {
        document.getElementById("divPrizeMore").style.display = 'inline';
        document.getElementById("liPrizeMoreLess").innerHTML = "<a class=\"upArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:LessPrize()\">Less</a>";
    }
    function LessPrize() {
        document.getElementById("divPrizeMore").style.display = 'none';
        document.getElementById("liPrizeMoreLess").innerHTML = "<a class=\"downArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:GetMorePrize()\">More</a>";
    }
</script>

        </div>
        </div>
        <div class="right-column">
            <div class="result-heading"><div class="search-summary search-heading"> <h1>Showing results for <span>"9789395185097"</span></h1><div class="preferences-show"><b>1</b> results found</div></div><div class="user-preferences"><div><div class="lg-btn"><a href="javascript:ChangePageLayout('list');"><img style="vertical-align:top" src="https://www.bookswagon.com/images/buttons/list-view-btnhover.gif" title="List view" alt="List view"></a><a href="javascript:ChangePageLayout('grid');"><img style="vertical-align:top" onmouseout="this.src='https://www.bookswagon.com/images/buttons/grid-view-btn.gif'" onmouseover="this.src='https://www.bookswagon.com/images/buttons/grid-view-btnhover.gif'" src="https://www.bookswagon.com/images/buttons/grid-view-btn.gif" title="Grid view" alt="Grid view"></a></div><div class="sortddl-lbl"> Sort By:</div><div class="sortddl" id="divSort"><select id="ddlSort" name="Sort" class="styled"><option value="all" selected="selected">Relevance</option><option value="PopularCount desc">Best Seller</option><option value="Product_TitleSort asc">Title - A to Z</option><option value="Product_TitleSort desc">Title - Z to A</option><option value="Product_ActualPrice asc">Price - Low to High</option><option value="Product_ActualPrice desc">Price - High to Low</option><option value="Product_discount asc">Discount - Low to High</option><option value="Product_discount desc">Discount - High to Low</option></select></div> <div class="clearfloat"></div></div></div><div class="clearfloat"></div><div class="filters"><a href="javascript:void(0);"></a></div></div>

<div class="product" id="listSearchResult">
<style>
    .rating-stars img{width:15px}
.rating-stars-offslider {
    display: inline-block;
    white-space: nowrap;
    vertical-align: text-bottom;
}
.rating-stars-onslider {
    left: 0px;
    color: red;
    overflow: hidden;
    white-space: nowrap;
}
    @media only screen and (max-width:767px) {
        .rating-stars img{width:12px}
    }
</style>
<div class="list-view-books"><div class="serialno">1. </div><div class="cover"><a href="https://www.bookswagon.com/book/manual-recent-clinical-techniques-in/9789395185097"><img src="https://www.bookswagon.com/BW/productimages/mainimages/notavailable.gif" alt="Manual On Recent Clinical Techniques In Veterinary Biochemistry I" onerror="handleInvalidImages(this,'mainimages')" height="150" width="100"></a><span class="cover-discount-tag">31<span class="percent-sign"> %</span> </span></div><div class="product-summary"><div class="title"><a href="https://www.bookswagon.com/book/manual-recent-clinical-techniques-in/9789395185097">Manual On Recent Clinical Techniques In Veterinary Biochemistry I</a></div><div class="author-publisher">By: <a href="https://www.bookswagon.com/author/books-wagon">Books Wagon</a></div><div class="author-publisher">Publisher: <a href="https://www.bookswagon.com/publisher/books-wagon">Books Wagon</a> </div><div class="d-block"><span class="rating-stars-container d-block" style="padding-left: 0px"><input type="hidden" class="avergageratingslider" value="0.0"><span class="rating-stars rating-stars-offslider position-relative" aria-hidden="true"><img src="../../images/svg/graystar.svg"><img src="../../images/svg/graystar.svg"><img src="../../images/svg/graystar.svg"><img src="../../images/svg/graystar.svg"><img src="../../images/svg/graystar.svg"><span class="rating-stars rating-stars-onslider position-absolute" style="width: 2%;"><img src="../../images/svg/redstar.svg"><img src="../../images/svg/redstar.svg"><img src="../../images/svg/redstar.svg"><img src="../../images/svg/redstar.svg"><img src="../../images/svg/redstar.svg"></span></span></span><span class="noreviewyet">No Review Yet</span></div><div class="price-attrib"><div class="price"><div class="list">₹2,295</div><div class="sell">₹1,584</div></div><div class="right-border1"></div><div class="attributes"><table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr><td valign="top"><div class="attributes-head">Binding:</div></td><td valign="top"><div class="attributes-title">Paperback</div></td></tr><tr><td valign="top"><div class="attributes-head">Release:</div></td><td valign="top"><div class="attributes-title">01 Jan 2023</div></td></tr><tr><td valign="top"><div class="attributes-head">Language:</div></td><td valign="top"><div class="attributes-title">English</div></td></tr></tbody></table><div class="clearfloat"></div></div><div class="clearfloat"></div></div></div><div class="action"><div class="available-stock">Available</div><div class="order-info">Ships within <span>6-8 Days</span> <a rel="nofollow" class="wws-detail cboxElement" href="https://www.bookswagon.com/shippingpopup.aspx">Explain..</a></div><div class="action-btns"></div><div class="action-btns"><input type="button" class="btn-red" value="Add to cart" onclick="AddtoCart('39288152',1,'36',1)"><input type="button" class="btn-black" value="Add to Wishlist" style="margin-top:11px" onclick="AddToWishlist('39288152');"><label id="lblcartmsg_39288152" class="alert alert-success"></label></div></div><div class="clearfloat"></div><div class="description"></div></div>
<script>
    $("#listSearchResult .list-view-books").each(function () {
        var avergagerating = $(this).find(".avergageratingslider").val();
        if (avergagerating > 3) { $(this).find(".averageratingbox").addClass('highrating') }
        else if (avergagerating < 2) { $(this).find(".averageratingbox").addClass('lowrating') }
        else { $(this).find(".averageratingbox").addClass('moderaterating') }
        if (avergagerating.indexOf('.') > 0) {
            var ldf = avergagerating.split('.')[1];
            if (ldf > 6) {
                $(this).find(".rating-stars-onslider").css("width", (avergagerating * 20 - 3 + "%"));
            }
            else if (ldf < 3) {
                $(this).find(".rating-stars-onslider").css("width", (avergagerating * 20 + 2 + "%"));
            }
            else {
                $(this).find(".rating-stars-onslider").css("width", (avergagerating * 20 + "%"));
            }
        }
        else {
            $(this).find(".rating-stars-onslider").css("width", (avergagerating * 20 + "%"));
        }
        // if (avergagerating == 0 && $(".avergagerating").parents().hasClass('ratingstartarea')) { $(".ratingstartarea").css("pointer-events","none") }/

    });

</script></div><div class="loading-page"> No more records found</div>

<div style="float: left">
    
    
</div>
<script language="javascript" type="text/javascript">
  
    var pageNo = 1;
    var totalRecords =1;
    var pageSize =20;
    var search_term ='9789395185097';
    var searchId =0;
    var filter ='filter';
    var productType =1;
    var pageLayout ='list';
    var searchType='books';
     var pageType='~';
     var trOn = "off";

</script>

        </div>
        <div class="clearfloat"></div>
    </div>
    <div class="clearfloat">
    </div>


        </div>

## Header reference

<div id="site-wrapper">
             
   
   
    <div class="search-results fltrs">
    
    <div class="rwd1">
    <div class="close-tag"><a href="javascript:void(0);">Close</a></div>
    
        <div class="left-column">
          
           
            
<!-- Desktop View -->
<div class="search-criteria"><h2> Refine your Search </h2><h3><strong>Search Within</strong></h3><ul><li class="active"><a href="https://www.bookswagon.com/search-books/9789395185097/filter?sid=0&amp;tab=1">Show All (1)</a></li><li><a href="https://www.bookswagon.com/search-books/9789395185097/title?sid=0&amp;tab=2">By Title (1)</a></li></ul><h3><input type="hidden" id="hdnPR" value="0">By Price</h3><ul><li class="active"><a href="javascript:void(0);">All <span> (1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','PR:4');">Rs.1000 - Rs.2000  <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnDiscount" value="0">By Discount</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Discount:4');">31% - 40% <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnStock" value="0">Availability</h3><ul><li class="active"><a href="javascript:void(0)">All <span> (1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Stock:1');"> In Stock <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnST" value="0">Shipping Time</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','ShippingTime:1');">Within 1 Week <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnSource" value="0">Source</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Source:1');">Indian <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnBinding" value="0">Binding</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Binding:1');">PaperBack <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnLang" value="0">Language</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','Language:English');">English <span>(1)</span></a></li></ul><h3><input type="hidden" id="hdnPubYear" value="0">Publication Year</h3><ul><li class="active"><a href="javascript:void(0)">All <span>(1)</span></a></li><li><a href="javascript:GetSearchCriteria('books','PubYear:2023');">2023 <span>(1)</span></a></li></ul></div>

<!-- JavaScript variables -->
<script language="javascript" type="text/javascript">
    var search_term = "9789395185097";
    var filter = "filter";
    var pageType = "search";
    var searchType = "books";
    var id_search = "0";
</script>

<!-- TEMPORARY FILTER OPEN BUTTON - For testing only -->

<!-- Mobile Filters HTML (All tabs from desktop view) -->
<div id="mobileFiltersContainer" style="display: none;">
    <!-- Overlay -->
    <div class="darkfilter-overlay" style="display: none;"></div>

    <!-- Mobile Container -->
    <div class="mobile-container" style="display: none;">
        <!-- Header -->
        <div class="headerfilter">
            <h2>Filter</h2>
            <span class="closefilter-btn">×</span>
        </div>

        <!-- Main Layout: Split View -->
        <div class="filter-body">
            <!-- Left Sidebar (Tabs) - All desktop filter types -->
            <ul class="sidebarfilter">

                <li class="sidebarfilter-item active" onclick="openTab(event, 'price')">Price</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'discount')">Discount</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'availability')">Availability</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'shippingTime')">Shipping Time</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'source')">Source</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'binding')">Binding</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'language')">Language</li>
                <li class="sidebarfilter-item" onclick="openTab(event, 'pubYear')">Publication Year</li>

            </ul>

            <!-- Right Content Area -->
            <div class="content-area" id="mobileContentArea">
                <!-- Search Within Tab -->


                <!-- Price Tab -->
                <div id="price" class="tab-content active">

                    <label class="item-row">
                        <input type="radio" name="mobilePrice" value="0" id="priceAll" checked="">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="radio" name="mobilePrice" value="4" id="price4">
                        Rs.1000 - Rs.2000 <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Discount Tab -->
                <div id="discount" class="tab-content">

                    <label class="item-row">
                        <input type="radio" name="mobileDiscount" value="0" id="discountAll" checked="">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="radio" name="mobileDiscount" value="4" id="discount4">
                        31% - 40% <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Availability Tab -->
                <div id="availability" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileStock" value="0" id="stockAll" checked="" onclick="handleAllCheckbox(this, 'mobileStock')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileStock" value="1" id="stockInStock">
                        In Stock <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Shipping Time Tab -->
                <div id="shippingTime" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileShippingTime" value="0" id="stAll" checked="" onclick="handleAllCheckbox(this, 'mobileShippingTime')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileShippingTime" value="1" id="st1">
                        Within 1 Week <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Source Tab -->
                <div id="source" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileSource" value="0" id="sourceAll" checked="" onclick="handleAllCheckbox(this, 'mobileSource')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileSource" value="1" id="sourceIndian">
                        Indian <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Binding Tab -->
                <div id="binding" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileBinding" value="0" id="bindingAll" checked="" onclick="handleAllCheckbox(this, 'mobileBinding')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileBinding" value="1" id="bindingPaperback">
                        Paperback <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Language Tab -->
                <div id="language" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobileLanguage" value="0" id="langAll" checked="" onclick="handleAllCheckbox(this, 'mobileLanguage')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobileLanguage" value="English" id="langEnglish">
                        English <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Publication Year Tab -->
                <div id="pubYear" class="tab-content">

                    <label class="item-row">
                        <input type="checkbox" name="mobilePubYear" value="0" id="pubYearAll" checked="" onclick="handleAllCheckbox(this, 'mobilePubYear')">
                        All <span class="count">(1)</span>
                    </label>

                    <label class="item-row">
                        <input type="checkbox" name="mobilePubYear" value="2023" id="pubYear2023">
                        2023 <span class="count">(1)</span>
                    </label>

                </div>

                <!-- Prize Tab -->
                <div id="prize" class="tab-content">

                </div>
            </div>
        </div>

        <!-- Footer buttons - Always visible -->
        <div class="footerfilter">
            <button class="clear-btn" type="button" onclick="MobileFilters.clearAll(); return false;">Clear Filters</button>
            <button class="apply-btn" type="button" onclick="MobileFilters.apply(); return false;">Apply Filters</button>
        </div>
    </div>

</div>

<!-- Font Awesome for icons -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<!-- Mobile Filters CSS -->
<style type="text/css">
    /* ========== MOBILE FILTERS CSS - HORIZONTAL LAYOUT ========== */
    #mobileFiltersContainer {
        display: none;
    }

    .cover .cover-discount-tag{
                width: 38px!important;
  height: 56px!important;

  background: url(/images/staticimages/offer.svg)!important;
    background-repeat: no-repeat!important;
    background-size:100% auto!important;
    line-height:34px!important;
    }
    .cover .cover-discount-tag::before, .cover .cover-discount-tag1::before{display:none;}

    /* Mobile Container */
.mobile-container {
    width: 100%;
    height: 80vh;
    background-color: white;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    position: fixed;
    bottom: 55px;
    left: 0px;
    z-index: 100001;
    border-radius: 12px 12px 0 0;
    display: flex;
    flex-direction: column;
}

    /* Overlay */
    .darkfilter-overlay {
        width: 100%;
        position: fixed;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        left: 0;
        top: 0;
        z-index: 100000;
    }

    /* Header */
    .headerfilter {
        padding: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        background: white;
        flex-shrink: 0;
            border-radius: 5px 5px 0 0;
    }

        .headerfilter h2 {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin: 0;
        }

    .closefilter-btn {
        font-size: 24px;
        color: #888;
        cursor: pointer;
        line-height: 1;
    }

    /* Main Layout: Split View */
    .filter-body {
        display: flex;
        flex: 1;
        overflow: hidden;
        height: calc(100% - 120px);
    }

    /* Left Sidebar (Tabs) */
    .sidebarfilter {
        width: 35%;
        background-color: #f8f9fa;
        border-right: 1px solid #eee;
        list-style: none;
        padding: 0px;
        margin: 0;
        overflow-y: auto;
    }

    .sidebarfilter-item {
        padding: 15px 10px;
        font-size: 13px;
        color: #555;
        cursor: pointer;
        border-left: 4px solid transparent;
        transition: all 0.2s;
    }

        .sidebarfilter-item.active {
            background-color: white;
            border-left-color: #ff3f3f;
            font-weight: 600;
            color: #000;
        }

    /* Right Content Area */
    .content-area {
        width: 65%;
        background-color: white;
        overflow-y: auto;
        padding: 10px 0 70px 0;
    }

    /* Tab Content */
    .tab-content {
        display: none;
        animation: fadeIn 0.3s ease;
    }

        .tab-content.active {
            display: block;
        }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(5px);
        }

        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Item Styling */
    .item-row {
        display: flex;
        align-items: center;
        padding: 12px 15px;
        font-size: 13px;
        color: #333;
        cursor: pointer;
        border-bottom: 1px solid #f0f0f0;
    }

        .item-row:hover {
            background-color: #fafafa;
        }

        .item-row input[type="checkbox"],
        .item-row input[type="radio"] {
            margin-right: 12px;
            accent-color: #ff3f3f;
            transform: scale(1.1);
        }

            .item-row input[type="radio"]:checked + .item-row,
            .item-row input[type="checkbox"]:checked + .item-row {
                font-weight: 600;
                color: #ff3f3f;
            }

    .count {
        color: #888;
        margin-left: auto;
        font-size: 12px;
    }

    .readmore-link {
        display: block;
        padding: 10px 15px;
        color: #0066c0;
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
    }

        .readmore-link:hover {
            text-decoration: underline;
        }

    /* Footer - Fixed at bottom */
    .footerfilter {
padding: 15px;
    border-top: 1px solid #eee;
    background: white;
    position: fixed;
    bottom: 0;
    width: 100%;
    }

    .clear-btn {
        flex: 1;
        background-color: #6c757d;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
         width:48%;
    }



    .apply-btn {
        flex: 1;
        background-color: #ff3f3f;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(255, 63, 63, 0.3);
        transition: background-color 0.2s;
        width:48%;
    }

    .clear-btn:hover {
        background-color: #5a6268;
    }

    .apply-btn:hover {
        background-color: #e63636;
    }

    .clear-btn:active, .apply-btn:active {
        transform: translateY(1px);
    }

    /* Floating filter button */
    .mobile-filter-button {
        display: none;
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
    }

        .mobile-filter-button button {
            background: #ff3f3f;
            color: white;
            border: none;
            border-radius: 50px;
            padding: 15px 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(255, 63, 63, 0.3);
            transition: all 0.2s;
        }

            .mobile-filter-button button:hover {
                background: #e63946;
                transform: translateY(-2px);
                box-shadow: 0 6px 15px rgba(255, 63, 63, 0.4);
            }

            .mobile-filter-button button i {
                font-size: 18px;
            }

    .filter-count-badge {
        background: white;
        color: #ff3f3f;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 5px;
        font-weight: bold;
    }

    /* TEMPORARY BUTTON STYLES */
    #tempMobileFilterButton {
        display: block !important;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% {
            transform: scale(1);
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        }

        50% {
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(76, 175, 80, 0.6);
        }

        100% {
            transform: scale(1);
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        }
    }

    /* Hide on desktop */
    @media (min-width: 992px) {
        #mobileFiltersContainer {
            display: none !important;
        }

        #tempMobileFilterButton {
            display: none !important;
        }
    }

    /* Show on mobile */
    @media (max-width: 991px) {
        .mobile-filter-button {
            display: block !important;
        }

        /* Hide desktop filters on mobile */
        .search-criteria {
            display: none !important;
        }

        #tempMobileFilterButton {
            display: block !important;
        }
    }

    /* Scrollbar styling */
    .content-area::-webkit-scrollbar {
        width: 4px;
    }

    .content-area::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    .content-area::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 2px;
    }

    .sidebarfilter::-webkit-scrollbar {
        width: 3px;
    }

    .sidebarfilter::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    .sidebarfilter::-webkit-scrollbar-thumb {
        background: #ccc;
    }

    @media only screen and (max-width:768px){
          .list-view-books .price-attrib, .list-view-books .action {
        display: block !important;
    }
      #site-wrapper .list-view-books .attributes, .list, .right-border1, .order-info, .available-stock, .btn-black {
        display: none !important;
    }
      .list-view-books .cover{border-radius: 10px;
    border: 1px solid #f1f0f0;
   }
           .cattogglelayout .list-view-books{width:100%!important;}
        #listSearchResult.cattogglelayout .list-view-books .cover img{height:160px!important}
        #listSearchResult.cattogglelayout .list-view-books .action {
    display: inline-block !important;
    float: left !important;
    width: 200px !important;
    padding-left:15px!important;
  }
         #listSearchResult.cattogglelayout .title{text-align:left!important;}
        .cattogglelayout .product-summary{
            padding-left: 15px !important;
width: calc(100% - 100px);
    text-align: left !important;
}
.cattogglelayout .sell, .cattogglelayout .action, .cattogglelayout .author-publisher{text-align:left!important}
.cattogglelayout .cover{
    width: 100px !important;
    float: left;
}
        .list-view-books .cover img{
                        width: 100%;
    height: 235px !important;
    object-fit: contain;
    border-radius: 6px;
        }
    }
</style>

<!-- Mobile Filters JavaScript -->
<script type="text/javascript">
    // ========== MOBILE FILTERS JAVASCRIPT ==========
    var MobileFilters = {
        state: {
            searchWithin: 'filter',
            price: '0',
            discount: '0',
            stock: '0',
            shippingTime: '0',
            source: '0',
            binding: '0',
            language: '0',
            pubYear: '0',
            prize: '0'
        },

        init: function () {
            console.log("MobileFilters initialized for RefineSearch");

            if (window.innerWidth > 991) return;

            var container = document.getElementById('mobileFiltersContainer');
            if (container) {
                container.style.display = 'block';
            }

            var button = document.getElementById('mobileFilterButton');
            if (button) {
                button.style.display = 'block';
            }

            this.loadInitialState();
            this.setupEventListeners();
            this.updateFilterCount();
            this.switchTab('price');
            //this.switchTab('searchWithin');
        },

        loadInitialState: function () {
            try {
                // Load from hidden fields
                var hdnPR = document.getElementById('hdnPR');
                var hdnDiscount = document.getElementById('hdnDiscount');
                var hdnStock = document.getElementById('hdnStock');
                var hdnST = document.getElementById('hdnST');
                var hdnSource = document.getElementById('hdnSource');
                var hdnBinding = document.getElementById('hdnBinding');
                var hdnLang = document.getElementById('hdnLang');
                var hdnPubYear = document.getElementById('hdnPubYear');
                var hdnPrize = document.getElementById('hdnPrize');

                if (hdnPR) this.state.price = hdnPR.value || '0';
                if (hdnDiscount) this.state.discount = hdnDiscount.value || '0';
                if (hdnStock) this.state.stock = hdnStock.value || '0';
                if (hdnST) this.state.shippingTime = hdnST.value || '0';
                if (hdnSource) this.state.source = hdnSource.value || '0';
                if (hdnBinding) this.state.binding = hdnBinding.value || '0';
                if (hdnLang) this.state.language = hdnLang.value || '0';
                if (hdnPubYear) this.state.pubYear = hdnPubYear.value || '0';
                if (hdnPrize) this.state.prize = hdnPrize.value || '0';

                console.log("Loaded initial state:", this.state);

                // Update UI with loaded state
                this.updateUIFromState();
            } catch (e) {
                console.log("Could not load initial state:", e);
            }
        },

        setupEventListeners: function () {
            var self = this;

            var container = document.getElementById('mobileFiltersContainer');
            if (container) {
                container.addEventListener('change', function (e) {
                    if (e.target.type === 'checkbox' || e.target.type === 'radio') {
                        self.handleFilterChange(e.target);
                    }
                });
            }

            var closeBtn = document.querySelector('.closefilter-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.hide();
                });
            }

            var overlay = document.querySelector('.darkfilter-overlay');
            if (overlay) {
                overlay.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.hide();
                });
            }

            var filterBtn = document.querySelector('#mobileFilterButton button');
            if (filterBtn) {
                filterBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.show();
                });
            }

            var sidebarItems = document.querySelectorAll('.sidebarfilter-item');
            for (var i = 0; i < sidebarItems.length; i++) {
                var item = sidebarItems[i];
                item.addEventListener('click', function (e) {
                    e.preventDefault();
                    var onclickAttr = this.getAttribute('onclick');
                    if (onclickAttr) {
                        var match = onclickAttr.match(/'([^']+)'/);
                        if (match && match[1]) {
                            self.switchTab(match[1]);
                        }
                    }
                });
            }
        },

        switchTab: function (tabName) {
            var sidebarItems = document.querySelectorAll('.sidebarfilter-item');
            for (var i = 0; i < sidebarItems.length; i++) {
                sidebarItems[i].classList.remove('active');
            }

            var activeTab = null;
            for (var i = 0; i < sidebarItems.length; i++) {
                if (sidebarItems[i].getAttribute('onclick') && sidebarItems[i].getAttribute('onclick').indexOf(tabName) > -1) {
                    activeTab = sidebarItems[i];
                    break;
                }
            }
            if (activeTab) {
                activeTab.classList.add('active');
            }

            var tabContents = document.querySelectorAll('.tab-content');
            for (var i = 0; i < tabContents.length; i++) {
                tabContents[i].classList.remove('active');
            }

            var activeContent = document.getElementById(tabName);
            if (activeContent) {
                activeContent.classList.add('active');
            }
        },

        handleFilterChange: function (input) {
            var filterValue = input.value;
            var isChecked = input.checked;
            var filterType = '';
            var inputName = input.name;

            if (inputName === 'mobileSearchWithin') {
                filterType = 'searchWithin';
                if (isChecked) {
                    this.state.searchWithin = filterValue;
                }
            }
            else if (inputName === 'mobilePrice') {
                filterType = 'price';
                if (isChecked) {
                    this.state.price = filterValue;
                }
            }
            else if (inputName === 'mobileDiscount') {
                filterType = 'discount';
                if (isChecked) {
                    this.state.discount = filterValue;
                }
            }
            else if (inputName === 'mobileStock') {
                filterType = 'stock';
                this.updateCheckboxFilter('stock', filterValue, isChecked, input);
            }
            else if (inputName === 'mobileShippingTime') {
                filterType = 'shippingTime';
                this.updateCheckboxFilter('shippingTime', filterValue, isChecked, input);
            }
            else if (inputName === 'mobileSource') {
                filterType = 'source';
                this.updateCheckboxFilter('source', filterValue, isChecked, input);
            }
            else if (inputName === 'mobileBinding') {
                filterType = 'binding';
                this.updateCheckboxFilter('binding', filterValue, isChecked, input);
            }
            else if (inputName === 'mobileLanguage') {
                filterType = 'language';
                this.updateCheckboxFilter('language', filterValue, isChecked, input);
            }
            else if (inputName === 'mobilePubYear') {
                filterType = 'pubYear';
                this.updateCheckboxFilter('pubYear', filterValue, isChecked, input);
            }
            else if (inputName === 'mobilePrize') {
                filterType = 'prize';
                this.updateCheckboxFilter('prize', filterValue, isChecked, input);
            }

            console.log("Filter changed:", filterType, filterValue, isChecked);
            this.updateFilterCount();
        },

        updateCheckboxFilter: function (filterType, value, isChecked, input) {
            // Handle "All" option
            if (value === '0') {
                if (isChecked) {
                    // Uncheck all other checkboxes in this group
                    var checkboxes = document.querySelectorAll('input[name="mobile' +
                        filterType.charAt(0).toUpperCase() + filterType.slice(1) + '"]:not([value="0"])');
                    for (var i = 0; i < checkboxes.length; i++) {
                        checkboxes[i].checked = false;
                    }
                    this.state[filterType] = '0';
                }
                return;
            }

            // If any non-all checkbox is checked, uncheck the "All" checkbox
            if (isChecked) {
                var allCheckbox = document.querySelector('input[name="mobile' +
                    filterType.charAt(0).toUpperCase() + filterType.slice(1) + '"][value="0"]');
                if (allCheckbox && allCheckbox.checked) {
                    allCheckbox.checked = false;
                }
            }

            var currentValues = this.state[filterType];
            var valuesArray = currentValues === '0' ? [] : currentValues.split(',');

            if (isChecked && valuesArray.indexOf(value) === -1) {
                valuesArray.push(value);
            } else if (!isChecked && valuesArray.indexOf(value) !== -1) {
                valuesArray = valuesArray.filter(function (v) { return v !== value; });
            }

            // If no checkboxes are checked, set to '0'
            if (valuesArray.length === 0) {
                this.state[filterType] = '0';
                // Check the "All" checkbox
                var allCheckbox = document.querySelector('input[name="mobile' +
                    filterType.charAt(0).toUpperCase() + filterType.slice(1) + '"][value="0"]');
                if (allCheckbox) {
                    allCheckbox.checked = true;
                }
            } else {
                this.state[filterType] = valuesArray.join(',');
            }
        },

        show: function () {
            console.log("Showing mobile filter panel");
            var mobileContainer = document.querySelector('.mobile-container');
            var overlay = document.querySelector('.darkfilter-overlay');

            if (mobileContainer) {
                mobileContainer.style.display = 'flex';
            }
            if (overlay) {
                overlay.style.display = 'block';
            }
            document.body.style.overflow = 'hidden';

            // Reload state from hidden fields to ensure we have latest
            this.loadInitialState();
        },

        hide: function () {
            console.log("Hiding mobile filter panel");
            var mobileContainer = document.querySelector('.mobile-container');
            var overlay = document.querySelector('.darkfilter-overlay');

            if (mobileContainer) {
                mobileContainer.style.display = 'none';
            }
            if (overlay) {
                overlay.style.display = 'none';
            }
            document.body.style.overflow = '';
        },

        updateUIFromState: function () {
            // Update search within radio
            if (this.state.searchWithin) {
                var searchRadios = document.querySelectorAll('input[name="mobileSearchWithin"]');
                for (var i = 0; i < searchRadios.length; i++) {
                    if (searchRadios[i].value === this.state.searchWithin) {
                        searchRadios[i].checked = true;
                    } else if (this.state.searchWithin === 'filter' && searchRadios[i].value === 'filter') {
                        searchRadios[i].checked = true;
                    }
                }
            }

            // Update price radio
            if (this.state.price !== '0') {
                var priceRadios = document.querySelectorAll('input[name="mobilePrice"]');
                for (var i = 0; i < priceRadios.length; i++) {
                    if (priceRadios[i].value === this.state.price) {
                        priceRadios[i].checked = true;
                    }
                }
            } else {
                var priceAll = document.querySelector('input[name="mobilePrice"][value="0"]');
                if (priceAll) priceAll.checked = true;
            }

            // Update discount radio
            if (this.state.discount !== '0') {
                var discountRadios = document.querySelectorAll('input[name="mobileDiscount"]');
                for (var i = 0; i < discountRadios.length; i++) {
                    if (discountRadios[i].value === this.state.discount) {
                        discountRadios[i].checked = true;
                    }
                }
            } else {
                var discountAll = document.querySelector('input[name="mobileDiscount"][value="0"]');
                if (discountAll) discountAll.checked = true;
            }

            // Update checkbox filters
            this.updateCheckboxGroup('stock', this.state.stock);
            this.updateCheckboxGroup('shippingTime', this.state.shippingTime);
            this.updateCheckboxGroup('source', this.state.source);
            this.updateCheckboxGroup('binding', this.state.binding);
            this.updateCheckboxGroup('language', this.state.language);
            this.updateCheckboxGroup('pubYear', this.state.pubYear);
            this.updateCheckboxGroup('prize', this.state.prize);
        },

        updateCheckboxGroup: function (filterType, valueString) {
            var values = valueString === '0' ? [] : valueString.split(',');
            var checkboxes = document.querySelectorAll('input[name="mobile' +
                filterType.charAt(0).toUpperCase() + filterType.slice(1) + '"]');

            for (var i = 0; i < checkboxes.length; i++) {
                var cb = checkboxes[i];
                if (cb.value === '0') {
                    cb.checked = (values.length === 0);
                } else {
                    cb.checked = (values.indexOf(cb.value) !== -1);
                }
            }
        },

        apply: function () {
            console.log("Applying mobile filters:", this.state);

            // Update hidden fields with current state
            if (document.getElementById('hdnPR')) {
                document.getElementById('hdnPR').value = this.state.price;
            }
            if (document.getElementById('hdnDiscount')) {
                document.getElementById('hdnDiscount').value = this.state.discount;
            }
            if (document.getElementById('hdnStock')) {
                document.getElementById('hdnStock').value = this.state.stock;
            }
            if (document.getElementById('hdnST')) {
                document.getElementById('hdnST').value = this.state.shippingTime;
            }
            if (document.getElementById('hdnSource')) {
                document.getElementById('hdnSource').value = this.state.source;
            }
            if (document.getElementById('hdnBinding')) {
                document.getElementById('hdnBinding').value = this.state.binding;
            }
            if (document.getElementById('hdnLang')) {
                document.getElementById('hdnLang').value = this.state.language;
            }
            if (document.getElementById('hdnPubYear')) {
                document.getElementById('hdnPubYear').value = this.state.pubYear;
            }
            if (document.getElementById('hdnPrize')) {
                document.getElementById('hdnPrize').value = this.state.prize;
            }

            // Update filter based on search within
            var newFilter = this.state.searchWithin;
            if (newFilter && newFilter !== 'filter' && newFilter !== 'filter') {
                // Redirect to the appropriate search within URL
                var baseUrl = '';
                if (searchType === 'books') {
                    baseUrl = '/search-books/';
                } else if (searchType === 'ebooks') {
                    baseUrl = '/search-ebooks/';
                } else {
                    baseUrl = '/search/';
                }

                var tabId = '1';
                if (newFilter === 'title') tabId = '2';
                else if (newFilter === 'author') tabId = '3';
                else if (newFilter === 'publisher') tabId = '4';

                var url = baseUrl + encodeURIComponent(search_term) + '/' + newFilter + '?sid=' + id_search + '&tab=' + tabId;
                window.location.href = url;
                return;
            }

            // Call the existing GetSearchCriteria function
            if (typeof GetSearchCriteria === 'function') {
                GetSearchCriteria(searchType || 'books', '');
            } else {
                console.error("GetSearchCriteria function not found");
                // Fallback - reload page with updated filters
                location.reload();
            }

            this.hide();
        },

        clearAll: function () {
            console.log("Clearing all mobile filters");

            this.state = {
                searchWithin: 'filter',
                price: '0',
                discount: '0',
                stock: '0',
                shippingTime: '0',
                source: '0',
                binding: '0',
                language: '0',
                pubYear: '0',
                prize: '0'
            };

            // Update UI
            this.updateUIFromState();
            this.updateFilterCount();

            // Show success message
            alert('All filters cleared');
        },

        updateFilterCount: function () {
            var count = 0;

            if (this.state.searchWithin !== 'filter' && this.state.searchWithin !== '*') count++;
            if (this.state.price !== '0') count++;
            if (this.state.discount !== '0') count++;
            if (this.state.stock !== '0') count += this.state.stock.split(',').length;
            if (this.state.shippingTime !== '0') count += this.state.shippingTime.split(',').length;
            if (this.state.source !== '0') count += this.state.source.split(',').length;
            if (this.state.binding !== '0') count += this.state.binding.split(',').length;
            if (this.state.language !== '0') count += this.state.language.split(',').length;
            if (this.state.pubYear !== '0') count += this.state.pubYear.split(',').length;
            if (this.state.prize !== '0') count += this.state.prize.split(',').length;

            var badge = document.getElementById('mobileFilterCount');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }

            return count;
        }
    };

    // Helper function for "All" checkbox handling
    function handleAllCheckbox(allCheckbox, groupName) {
        if (allCheckbox.checked) {
            var checkboxes = document.querySelectorAll('input[name="' + groupName + '"]:not([value="0"])');
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].checked = false;
            }
            // Update state
            MobileFilters.state[groupName.replace('mobile', '').toLowerCase()] = '0';
        }
        MobileFilters.updateFilterCount();
    }

    // Helper functions for "Show More" links
    function showMoreLanguages() {
        document.getElementById('moreLanguages').style.display = 'block';
        event.target.style.display = 'none';
    }

    function showMorePubYears() {
        document.getElementById('morePubYears').style.display = 'block';
        event.target.style.display = 'none';
    }

    function showMorePrizes() {
        document.getElementById('morePrizes').style.display = 'block';
        event.target.style.display = 'none';
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        if (window.innerWidth <= 991) {
            MobileFilters.init();
        } else {
            var mobileFilterButton = document.getElementById('mobileFilterButton');
            if (mobileFilterButton) {
                mobileFilterButton.style.display = 'none';
            }
        }

        window.addEventListener('resize', function () {
            if (window.innerWidth <= 991) {
                MobileFilters.init();
            } else {
                MobileFilters.hide();
                var mobileFilterButton = document.getElementById('mobileFilterButton');
                if (mobileFilterButton) {
                    mobileFilterButton.style.display = 'none';
                }
            }
        });
    });

    // Helper function for onclick handlers
    function openTab(evt, tabName) {
        var tabContent = document.getElementsByClassName("tab-content");
        for (var i = 0; i < tabContent.length; i++) {
            tabContent[i].classList.remove("active");
        }

        var sidebarItems = document.getElementsByClassName("sidebarfilter-item");
        for (var i = 0; i < sidebarItems.length; i++) {
            sidebarItems[i].classList.remove("active");
        }

        var tabElement = document.getElementById(tabName);
        if (tabElement) {
            tabElement.classList.add("active");
        }
        evt.currentTarget.classList.add("active");
    }
</script>

<!-- Your existing JavaScript functions remain untouched -->
<script type="text/javascript">
    function GetMoreLanguage() {
        document.getElementById("divLangMore").style.display = 'inline';
        document.getElementById("liMoreLess").innerHTML = "<a class=\"upArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:LessLanguages()\">Less</a>";
    }
    function LessLanguages() {
        document.getElementById("divLangMore").style.display = 'none';
        document.getElementById("liMoreLess").innerHTML = "<a class=\"downArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:GetMoreLanguage()\">More</a>";
    }
    function GetMorePubYear() {
        document.getElementById("divPubMore").style.display = 'inline';
        document.getElementById("liPubMoreLess").innerHTML = "<a class=\"upArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:LessPubYear()\">Less</a>";
    }
    function LessPubYear() {
        document.getElementById("divPubMore").style.display = 'none';
        document.getElementById("liPubMoreLess").innerHTML = "<a class=\"downArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:GetMorePubYear()\">More</a>";
    }
    function GetMorePrize() {
        document.getElementById("divPrizeMore").style.display = 'inline';
        document.getElementById("liPrizeMoreLess").innerHTML = "<a class=\"upArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:LessPrize()\">Less</a>";
    }
    function LessPrize() {
        document.getElementById("divPrizeMore").style.display = 'none';
        document.getElementById("liPrizeMoreLess").innerHTML = "<a class=\"downArrow\" style=\"color:#0033CC;cursor:pointer\" onclick=\"javascript:GetMorePrize()\">More</a>";
    }
</script>

        </div>
        </div>
        <div class="right-column">
            <div class="result-heading"><div class="search-summary search-heading"> <h1>Showing results for <span>"9789395185097"</span></h1><div class="preferences-show"><b>1</b> results found</div></div><div class="user-preferences"><div><div class="lg-btn"><a href="javascript:ChangePageLayout('list');"><img style="vertical-align:top" src="https://www.bookswagon.com/images/buttons/list-view-btnhover.gif" title="List view" alt="List view"></a><a href="javascript:ChangePageLayout('grid');"><img style="vertical-align:top" onmouseout="this.src='https://www.bookswagon.com/images/buttons/grid-view-btn.gif'" onmouseover="this.src='https://www.bookswagon.com/images/buttons/grid-view-btnhover.gif'" src="https://www.bookswagon.com/images/buttons/grid-view-btn.gif" title="Grid view" alt="Grid view"></a></div><div class="sortddl-lbl"> Sort By:</div><div class="sortddl" id="divSort"><select id="ddlSort" name="Sort" class="styled"><option value="all" selected="selected">Relevance</option><option value="PopularCount desc">Best Seller</option><option value="Product_TitleSort asc">Title - A to Z</option><option value="Product_TitleSort desc">Title - Z to A</option><option value="Product_ActualPrice asc">Price - Low to High</option><option value="Product_ActualPrice desc">Price - High to Low</option><option value="Product_discount asc">Discount - Low to High</option><option value="Product_discount desc">Discount - High to Low</option></select></div> <div class="clearfloat"></div></div></div><div class="clearfloat"></div><div class="filters"><a href="javascript:void(0);"></a></div></div>

<div class="product" id="listSearchResult">
<style>
    .rating-stars img{width:15px}
.rating-stars-offslider {
    display: inline-block;
    white-space: nowrap;
    vertical-align: text-bottom;
}
.rating-stars-onslider {
    left: 0px;
    color: red;
    overflow: hidden;
    white-space: nowrap;
}
    @media only screen and (max-width:767px) {
        .rating-stars img{width:12px}
    }
</style>
<div class="list-view-books"><div class="serialno">1. </div><div class="cover"><a href="https://www.bookswagon.com/book/manual-recent-clinical-techniques-in/9789395185097"><img src="https://www.bookswagon.com/BW/productimages/mainimages/notavailable.gif" alt="Manual On Recent Clinical Techniques In Veterinary Biochemistry I" onerror="handleInvalidImages(this,'mainimages')" height="150" width="100"></a><span class="cover-discount-tag">31<span class="percent-sign"> %</span> </span></div><div class="product-summary"><div class="title"><a href="https://www.bookswagon.com/book/manual-recent-clinical-techniques-in/9789395185097">Manual On Recent Clinical Techniques In Veterinary Biochemistry I</a></div><div class="author-publisher">By: <a href="https://www.bookswagon.com/author/books-wagon">Books Wagon</a></div><div class="author-publisher">Publisher: <a href="https://www.bookswagon.com/publisher/books-wagon">Books Wagon</a> </div><div class="d-block"><span class="rating-stars-container d-block" style="padding-left: 0px"><input type="hidden" class="avergageratingslider" value="0.0"><span class="rating-stars rating-stars-offslider position-relative" aria-hidden="true"><img src="../../images/svg/graystar.svg"><img src="../../images/svg/graystar.svg"><img src="../../images/svg/graystar.svg"><img src="../../images/svg/graystar.svg"><img src="../../images/svg/graystar.svg"><span class="rating-stars rating-stars-onslider position-absolute" style="width: 2%;"><img src="../../images/svg/redstar.svg"><img src="../../images/svg/redstar.svg"><img src="../../images/svg/redstar.svg"><img src="../../images/svg/redstar.svg"><img src="../../images/svg/redstar.svg"></span></span></span><span class="noreviewyet">No Review Yet</span></div><div class="price-attrib"><div class="price"><div class="list">₹2,295</div><div class="sell">₹1,584</div></div><div class="right-border1"></div><div class="attributes"><table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr><td valign="top"><div class="attributes-head">Binding:</div></td><td valign="top"><div class="attributes-title">Paperback</div></td></tr><tr><td valign="top"><div class="attributes-head">Release:</div></td><td valign="top"><div class="attributes-title">01 Jan 2023</div></td></tr><tr><td valign="top"><div class="attributes-head">Language:</div></td><td valign="top"><div class="attributes-title">English</div></td></tr></tbody></table><div class="clearfloat"></div></div><div class="clearfloat"></div></div></div><div class="action"><div class="available-stock">Available</div><div class="order-info">Ships within <span>6-8 Days</span> <a rel="nofollow" class="wws-detail cboxElement" href="https://www.bookswagon.com/shippingpopup.aspx">Explain..</a></div><div class="action-btns"></div><div class="action-btns"><input type="button" class="btn-red" value="Add to cart" onclick="AddtoCart('39288152',1,'36',1)"><input type="button" class="btn-black" value="Add to Wishlist" style="margin-top:11px" onclick="AddToWishlist('39288152');"><label id="lblcartmsg_39288152" class="alert alert-success"></label></div></div><div class="clearfloat"></div><div class="description"></div></div>
<script>
    $("#listSearchResult .list-view-books").each(function () {
        var avergagerating = $(this).find(".avergageratingslider").val();
        if (avergagerating > 3) { $(this).find(".averageratingbox").addClass('highrating') }
        else if (avergagerating < 2) { $(this).find(".averageratingbox").addClass('lowrating') }
        else { $(this).find(".averageratingbox").addClass('moderaterating') }
        if (avergagerating.indexOf('.') > 0) {
            var ldf = avergagerating.split('.')[1];
            if (ldf > 6) {
                $(this).find(".rating-stars-onslider").css("width", (avergagerating * 20 - 3 + "%"));
            }
            else if (ldf < 3) {
                $(this).find(".rating-stars-onslider").css("width", (avergagerating * 20 + 2 + "%"));
            }
            else {
                $(this).find(".rating-stars-onslider").css("width", (avergagerating * 20 + "%"));
            }
        }
        else {
            $(this).find(".rating-stars-onslider").css("width", (avergagerating * 20 + "%"));
        }
        // if (avergagerating == 0 && $(".avergagerating").parents().hasClass('ratingstartarea')) { $(".ratingstartarea").css("pointer-events","none") }/

    });

</script></div><div class="loading-page"> No more records found</div>

<div style="float: left">
    
    
</div>
<script language="javascript" type="text/javascript">
  
    var pageNo = 1;
    var totalRecords =1;
    var pageSize =20;
    var search_term ='9789395185097';
    var searchId =0;
    var filter ='filter';
    var productType =1;
    var pageLayout ='list';
    var searchType='books';
     var pageType='~';
     var trOn = "off";

</script>

        </div>
        <div class="clearfloat"></div>
    </div>
    <div class="clearfloat">
    </div>


        </div>

## Product page reference

<div class="col-md-12">
                    <div class="col-md-12 mb-3 breadcrumbhide">
                        <a href="https://www.bookswagon.com" class="themecolor">Home</a> &gt; <a href="https://www.bookswagon.com/arts-photography-books" class="themecolor">Art, Film &amp; Photography</a> &gt; Manual On Recent Clinical Techniques In Veterinary Biochemistry I
                    </div>
                    <input type="hidden" name="ctl00$phBody$ProductDetail$hdnProductID" id="ctl00_phBody_ProductDetail_hdnProductID" value="39288152">
<input type="hidden" name="ctl00$phBody$ProductDetail$hdnVendor" id="ctl00_phBody_ProductDetail_hdnVendor" value="36">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

/_ ── Product Image ── _/

.apppricebox{display:none;}

.product-image-wrap img {
width: 100%;
height: 340px;
object-fit: contain;
pointer-events: none;
display: block;
}

/_ ── Zoom Overlay ── _/
.zoom-overlay {
position: fixed;
inset: 0;
background: #fff;
z-index: 9999;
display: none;
flex-direction: column;
touch-action: none;
}

.zoom-overlay.open { display: flex; }

/_ Top bar _/
.zoom-topbar {
position: absolute;
top: 0; left: 0; right: 0;
z-index: 10;
display: flex;
align-items: center;
justify-content: space-between;
padding: 48px 16px 14px;

}

.zoom-back {
width: 38px; height: 38px;
border-radius: 50%;
background: rgba(0,0,0,0.35);
border: none;
display: flex; align-items: center; justify-content: center;
cursor: pointer;
}
.zoom-back svg {
width: 18px; height: 18px;
fill: none; stroke: #fff;
stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round;
}

.zoom-reset-btn {
background: rgba(0,0,0,0.35);
border: none;
border-radius: 6px;
padding: 6px 14px;
color: #fff;
font-size: 0.75rem;
font-weight: 500;
cursor: pointer;
font-family: inherit;
opacity: 0;
pointer-events: none;
transition: opacity 0.2s;
}
.zoom-reset-btn.visible {
opacity: 1;
pointer-events: auto;
}

/_ Image inner _/
.zoom-image-wrap {
flex: 1;
position: relative;
overflow: hidden;
display: flex;
align-items: center;
justify-content: center;
}

#zoomImageInner {
position: absolute;
inset: 0;
display: flex;
align-items: center;
justify-content: center;
cursor: grab;
touch-action: none;
}

#zoomImageInner.grabbing { cursor: grabbing; }

#zoomImg {
max-width: 100%;
max-height: 100%;
object-fit: contain;
pointer-events: none;
will-change: transform;
transform-origin: center center;
user-select: none;
-webkit-user-drag: none;
}

/_ Hint badge _/
.zoom-hint {
position: absolute;
bottom: 10px; right: 12px;
background: rgba(0,0,0,0.5);
color: #fff;
font-size: 0.65rem;
padding: 4px 9px;
border-radius: 20px;
pointer-events: none;
transition: opacity 0.4s;
}
.zoom-hint.hidden { opacity: 0; }

/_ Double-tap ripple _/
.tap-ripple {
position: absolute;
width: 60px; height: 60px;
margin-left: -30px; margin-top: -30px;
border-radius: 50%;
background: rgba(255,255,255,0.25);
transform: scale(0);
animation: ripple 0.4s ease-out forwards;
pointer-events: none;
}

img#zoomImg {
width: 80% !important;
}

@media only screen and (max-width:768px){
.zoomContainer{display:none;}
}
@keyframes ripple { to { transform: scale(3); opacity: 0; } }
</style>

<div id="detailcol1" class="text-center">
    <div class="position-relative">
        <div id="ctl00_phBody_ProductDetail_disDiscount" class="offer position-absolute">31%</div>
        <div class="product-image-wrap" id="productImage">
        <img src="https://www.bookswagon.com/BW/productimages/mainimages/notavailable.gif" id="ctl00_phBody_ProductDetail_imgProduct" onerror="handleInvalidImages(this,'mainimages')" style="display: inline-block;" class="card-img-top bklazy" data-zoom-image="https://www.bookswagon.com/BW/productimages/mainimages/097/9789395185097.jpg" alt="Manual On Recent Clinical Techniques In Veterinary Biochemistry I" title="Manual On Recent Clinical Techniques In Veterinary Biochemistry I">
            </div>
        <div class="zoom-overlay" id="zoomOverlay">
  <div class="zoom-topbar">
    <button class="zoom-back" id="zoomBack">
      <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    <button class="zoom-reset-btn" id="zoomResetBtn">Reset</button>
  </div>

  <div class="zoom-image-wrap">
    <div id="zoomImageInner">
      <img id="zoomImg" src="https://www.bookswagon.com/BW/productimages/mainimages/097/9789395185097.jpg" alt="Zoom">
    </div>
  </div>
  <div class="zoom-hint hidden" id="zoomHint">🔍 Tap to zoom</div>
</div>
        <div class="clearfix"></div>
        
         <!-- SHARE BUTTON -->


                <!-- SHARE POPUP (will be shown/hidden by JavaScript) -->
                <div id="sharePopup" class="share-popup">
                    <div class="share-popup-inner">
                        <button class="share-close-btn" type="button" aria-label="Close">×</button>
                        <h6>Share this product</h6>

                        <a id="shareWhatsapp" target="_blank" rel="noopener" class="share-btn" onclick="shareWhatsapp(event)">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" style="margin-right: 8px; vertical-align: middle;">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.76.982.998-3.675-.236-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.9 6.994c-.004 5.45-4.438 9.88-9.888 9.88m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.333.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.333 11.893-11.893 0-3.18-1.24-6.162-3.495-8.411"></path>
                            </svg>
                            WhatsApp
                        </a>
                        <a id="shareFacebook" target="_blank" rel="noopener" class="share-btn" onclick="shareFacebook(event)">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" style="margin-right: 8px; vertical-align: middle;">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path>
                            </svg>
                            Facebook
                        </a>
                        <a id="shareTwitter" target="_blank" rel="noopener" class="share-btn" onclick="shareTwitter(event)">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1DA1F2" style="margin-right: 8px; vertical-align: middle;">
                                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.213c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"></path>
                            </svg>
                            Twitter
                        </a>
                        <a id="shareLinkedin" target="_blank" rel="noopener" class="share-btn" onclick="shareLinkedin(event)">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2" style="margin-right: 8px; vertical-align: middle;">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"></path>
                            </svg>
                            LinkedIn
                        </a>
                        <a id="shareEmail" href="#" class="share-btn" onclick="shareEmail(event)">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#EA4335" style="margin-right: 8px; vertical-align: middle;">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path>
                            </svg>
                            Email
                        </a>

                        <div class="copy-link-section">
                            <div class="copy-row">
                                <input type="text" id="shareLinkInput" readonly="" placeholder="Product link">
                                <button id="copyLinkBtn" class="copy-btn">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 5px; vertical-align: middle;">
                                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path>
                                    </svg>
                                    Copy
                                </button>
                            </div>
                            <div id="copyStatus" class="copy-status">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="#28a745" style="margin-right: 5px; vertical-align: middle;">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
                                </svg>
                                Link copied to clipboard
                            </div>
                        </div>
                    </div>
                </div>
                <!-- END SHARE POPUP -->


    </div>

</div>

<div id="detailcol2">
    <h1 style="display: inline-block"><span id="ctl00_phBody_ProductDetail_lblTitle" class="themecolor headingtext">Manual On Recent Clinical Techniques In Veterinary Biochemistry I</span>
        <label id="ctl00_phBody_ProductDetail_lblBinding">(Paperback)</label>
        <label id="ctl00_phBody_ProductDetail_lblRelease"> | Released: 01 Jan 2023</label>
    <div class="share-icon" id="btnShareProduct" title="Share">
                    
                    <img src="/images/staticimages/share.svg" alt="Share" width="22" height="22">
                </div></h1>
    <div class=" d-inline authordetailtext">
        <label id="ctl00_phBody_ProductDetail_lblAuthor1">By: <a href="https://www.bookswagon.com/author/books-wagon">Books Wagon</a></label>
        <label id="ctl00_phBody_ProductDetail_lblAuthorType1">(Author)</label>
        <label id="ctl00_phBody_ProductDetail_lblAuthor2"></label>
        <label id="ctl00_phBody_ProductDetail_lblAuthorType2"></label>
        <label id="ctl00_phBody_ProductDetail_lblAuthor3"></label>
        <label id="ctl00_phBody_ProductDetail_lblAuthorType3"></label>
        <label id="ctl00_phBody_ProductDetail_lblAuthor4"></label>
        <label id="ctl00_phBody_ProductDetail_lblAuthorType4"></label>
        <label id="ctl00_phBody_ProductDetail_lblAuthor5"></label>
        <label id="ctl00_phBody_ProductDetail_lblAuthorType5"></label>
        <label id="ctl00_phBody_ProductDetail_lblPublisher"> | Publisher: <a href="https://www.bookswagon.com/publisher/books-wagon">Books Wagon</a></label>
        <label id="ctl00_phBody_ProductDetail_lblPublisherImprint"></label>
    </div>
    <div class="ratingstartarea position-relative">
        
<style>
.rating-stars img{width:19px}
.rating-stars-off {
    display: inline-block;
    white-space: nowrap;
    vertical-align: text-bottom;
}
.rating-stars-on {
    left: 0px;
    color: red;
    overflow: hidden;
    white-space: nowrap;
}
</style>

<span id="ctl00_phBody_ProductDetail_StarRating_LblAvgRate" class="avergagerating"></span>&nbsp;
<span class="rating-stars-container" style="padding-left: 0px">
<span class="rating-stars rating-stars-off position-relative" aria-hidden="true">
<img src="../../images/svg/graystar.svg" id="ctl00_phBody_ProductDetail_StarRating_Star1">
<img src="../../images/svg/graystar.svg" id="ctl00_phBody_ProductDetail_StarRating_Star2">
<img src="../../images/svg/graystar.svg" id="ctl00_phBody_ProductDetail_StarRating_Star3">
<img src="../../images/svg/graystar.svg" id="ctl00_phBody_ProductDetail_StarRating_Star4">
<img src="../../images/svg/graystar.svg" id="ctl00_phBody_ProductDetail_StarRating_Star5">
<span class="rating-stars rating-stars-on position-absolute" style="width: 0%;">
<img src="../../images/svg/redstar.svg">
<img src="../../images/svg/redstar.svg">
<img src="../../images/svg/redstar.svg">
<img src="../../images/svg/redstar.svg">
<img src="../../images/svg/redstar.svg">
</span>

    </span>


    <span id="ctl00_phBody_ProductDetail_StarRating_LblBlankSpace">&nbsp;&nbsp;&nbsp;&nbsp;</span>

    &nbsp;
    &nbsp;

</span>

<script>

    var avergagerating = $(".avergagerating:eq(0)").text();
   /* if (avergagerating == 0 && $(".avergagerating").parents().hasClass('ratingstartarea')) { $(".ratingstartarea").css("pointer-events","none") }*/
    $(".rating-stars-on").css("width", (avergagerating * 20 + "%"));
</script>

        <div class="bv-flex-container-column-hover">
            <div class="nav-arrow" style="position: absolute; left: 50%; top: -9px"></div>


<style>
    .ratings-star-container-hover {
        display: block;
        float: left;
        width: 100%;
        margin: 3px 0;
    }

    .ratings-star, .ratings-bar, .ratings-score {
        float: left;
    }

    .ratings-bar {
        width: calc(100% - 100px);
        height: 10px;
        background: #f0f0ef;
        margin: 8px;
        border-radius: 3px;
        position: relative;
    }
    .ratings-star-container.clickable, .ratings-star-container-hover.clickable{cursor:pointer}

    .ratings-score {
        padding: 0px 10px;
    }

    .ratings-bar span {
        display: inline-block;
        background: #347d56 !important;
        height: 10px;
        position: absolute;
        border-radius: 3px 0 0 3px;
    }

    .ratings-star img {
        width: 17px;
        padding-left: 3px;
        margin-top: -2px;
    }
</style>
<div class="w-100" style="overflow:hidden;">
<div class="ratings-star-container-hover" data-reviewvalue="5 Star">
    <div class="ratings-star">5<img src="../../images/svg/redstar.svg">
    </div>
    <div class="ratings-bar">
        <span></span>
    </div>
    <div class="ratings-score">
        <span aria-hidden="true"><span id="ctl00_phBody_ProductDetail_BarStarRating_LblStar5">0</span> </span>
    </div>
</div>

<div class="ratings-star-container-hover" data-reviewvalue="4 Star">
    <div class="ratings-star">4<img src="../../images/svg/redstar.svg">
    </div>
    <div class="ratings-bar">
        <span></span>
    </div>
    <div class="ratings-score">
        <span aria-hidden="true"><span id="ctl00_phBody_ProductDetail_BarStarRating_LblStar4">0</span> </span>
    </div>
</div>

<div class="ratings-star-container-hover" data-reviewvalue="3 Star">
    <div class="ratings-star">3<img src="../../images/svg/redstar.svg">
    </div>
    <div class="ratings-bar">
        <span></span>
    </div>
    <div class="ratings-score">
        <span aria-hidden="true"><span id="ctl00_phBody_ProductDetail_BarStarRating_LblStar3">0</span> </span>
    </div>
</div>

<div class="ratings-star-container-hover" data-reviewvalue="2 Star">
    <div class="ratings-star">2<img src="../../images/svg/redstar.svg">
    </div>
    <div class="ratings-bar">
        <span></span>
    </div>
    <div class="ratings-score">
        <span aria-hidden="true"><span id="ctl00_phBody_ProductDetail_BarStarRating_LblStar2">0</span> </span>
    </div>
</div>

<div class="ratings-star-container-hover" data-reviewvalue="1 Star">
    <div class="ratings-star">1<img src="../../images/svg/redstar.svg">
    </div>
    <div class="ratings-bar">
        <span></span>
    </div>
    <div class="ratings-score">
        <span aria-hidden="true"><span id="ctl00_phBody_ProductDetail_BarStarRating_LblStar1">0</span> </span>
    </div>
</div>
</div>
<input type="hidden" name="ctl00$phBody$ProductDetail$BarStarRating$HiddenStarTotal" id="ctl00_phBody_ProductDetail_BarStarRating_HiddenStarTotal" value="0">

<script>

    $(".ratings-star-container-hover").each(function () { var ldf = $(this).find(".ratings-score").text(); var totalscore = $("#ctl00_phBody_ProductDetail_BarStarRating_HiddenStarTotal").val(); var averagescore = ldf / totalscore * 100; $(this).find(".ratings-bar span").css("width", (Math.round(averagescore) + "%")); if (ldf > 0) { $(this).addClass("clickable") } });

    $(".ratings-star-container.clickable").on("click", function () {
        var ratingstar = $(this).attr("data-reviewvalue"); var ratingstarclass = ratingstar.replace(" ", "").toLowerCase(); if (!$('.ratingfilterheader li').hasClass(ratingstarclass)) { $(".ratingfilterheader").append("<li class='list-inline-item " + ratingstarclass + "'><a href='javascript:void(0)'>" + ratingstar + " <i class='fas fa-times-circle' aria-hidden='true'></i></a></li>") }; $(".activefilters").show();

    });

</script>

            <div class="text-center mt-2" style="width: 100%; float: left; overflow: hidden;">
                <a href="javascript:void(0)" class="btn themebackground text-white readallreview">Write Reviews</a>

            </div>
        </div>
    </div>
    <div class="d-block mt-3">
        <div class="mobileprice">
            <span class="savingPriceOverride">-31%</span>
            <span class="a-price">
                ₹1,584
            </span>
            <br>
            <span class="maxpricedetailmob">
                M.R.P. :₹2,295
            </span>
        </div>




        <div class="desktopprice">
            <span class="originalprice">
                <label id="ctl00_phBody_ProductDetail_lblourPrice">₹1,584</label>
            </span>

            <span class="maxpricedetail"><del>
                <label id="ctl00_phBody_ProductDetail_lblListPrice">M.R.P. :<del>₹2,295</del><br></label>
            </del></span>
            <span class="saveamount">
                <label id="ctl00_phBody_ProductDetail_lblSaveAmount">Save: ₹711(31%)</label>
            </span>
        </div>
        <div class="available mt-2 mb-2">
            <span id="ctl00_phBody_ProductDetail_lblAvailable" style="color: green" class="available">Available</span>
            <p>
                <label id="ctl00_phBody_ProductDetail_lblBusiness">Ships within <b>6-8 Business Days</b></label>
                <br>
                <label id="ctl00_phBody_ProductDetail_lishipping"></label>
            </p>
        </div>
        <div class="action">

        </div>

    </div>




    <style>
        /* Heading size still comes from the legacy "#aboutbook .themecolor" rule
           in newstyle.css, so it matches the old section heading. */
        #aboutbook .aboutbookheading {
            display: block;
            margin-bottom: 6px;
        }

        #aboutbook .aboutbookbody {
            font-size: 14px;
            line-height: 22px;
        }

            /* newstyle.css forces 16px on #aboutbook b/p for the old bottom-of-page
               block; inline near the top it has to match the surrounding 14px copy. */
            #aboutbook .aboutbookbody b,
            #aboutbook .aboutbookbody p {
                font-size: 14px !important;
                line-height: 22px !important;
            }

            /* first child must not push the text down with its own top margin,
               or the two visible lines become one and a half */
            #aboutbook .aboutbookbody > *:first-child,
            #aboutbook .aboutbookbody > div > *:first-child {
                margin-top: 0 !important;
            }

            /* Two lines exactly: 2 x 22px line-height. A height clamp rather than
               -webkit-line-clamp, because the body can contain a Table of Contents
               with block-level markup that line-clamp mangles. */
            #aboutbook .aboutbookbody.aboutbook-collapsed {
                max-height: 44px;
                overflow: hidden;
                position: relative;
            }

                /* fade the cut-off edge so it reads as "there is more" */
                #aboutbook .aboutbookbody.aboutbook-collapsed:after {
                    content: "";
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    height: 20px;
                    background: linear-gradient(to bottom, rgba(255,255,255,0), #fff 92%);
                    pointer-events: none;
                }

        #aboutbook a.readmoredesc {
            display: inline-block;
            margin-top: 4px;
            cursor: pointer;
            color: #007185;
            font-size: 14px;
        }
    </style>

    <div id="aboutbook" class="descriptionbook">
        <span class="themecolor font-weight-bold aboutbookheading">About the Book</span>
        <div class="aboutbookbody" id="aboutbookbody">
            <div id="ctl00_phBody_ProductDetail_lblLongDesc">Manual On Recent Clinical Techniques In Veterinary Biochemistry I</div>
        </div>
        <a href="javascript:void(0)" class="readmoredesc" id="aboutbooktoggle" style="display: none;">read more</a>
    </div>

<div id="product-property" class="owl-carousel owl-loaded">

<div class="owl-stage-outer"><div class="owl-stage" style="transform: translate3d(0px, 0px, 0px); transition: all; width: 537px;"><div class="owl-item active" style="width: 97.291px; margin-right: 10px;"><div class="item text-center">
        <span class="d-block">ISBN-10</span>
        <img src="https://www.bookswagon.com/images/icons/isbnicon.jpg">
        <span class="d-block font-weight-bold">9395185090</span>
    </div></div><div class="owl-item active" style="width: 97.291px; margin-right: 10px;"><div class="item text-center">
        <span class="d-block">ISBN-13</span>
        <img src="https://www.bookswagon.com/images/icons/isbnicon.jpg">
        <span class="d-block font-weight-bold">9789395185097</span>
    </div></div><div class="owl-item active" style="width: 97.291px; margin-right: 10px;"><div class="item text-center">
        <span class="d-block">Page Number</span>
        <img src="https://www.bookswagon.com/images/icons/pagenumbicon.jpg">
        <span class="d-block font-weight-bold">2295</span>
    </div></div><div class="owl-item active" style="width: 97.291px; margin-right: 10px;"><div class="item text-center">
        <span class="d-block">Language</span>
        <img src="https://www.bookswagon.com/images/icons/language.png">
        <span class="d-block font-weight-bold">English</span>
    </div></div><div class="owl-item active" style="width: 97.291px; margin-right: 10px;"><div class="item text-center">
        <a href="#" class="seedetailall">See all details </a>
    </div></div></div></div><div class="owl-nav disabled"><button type="button" role="presentation" class="owl-prev disabled"><span aria-label="Previous">‹</span></button><button type="button" role="presentation" class="owl-next disabled"><span aria-label="Next">›</span></button></div><div class="owl-dots disabled"></div></div>

<script>
    $(document).on("click", ".seedetailall", function () {
        $('html, body').animate({
            scrollTop: $("#bookdetail").offset().top - 80
        }, 2000);
    });

</script>

<div id="besticon">
    <div class="icongridwrapper">
        <div class="icon-grid-width text-center">
            <img src="https://www.bookswagon.com/images/icons/premium-quality.png">
            <div class="icontextwrap"><span class="a-size-small">Premium quality </span></div>
            <div class="clickpopup">
                <div class="nav-arrow" style="position: absolute; left: 50%; top: -9px"></div>
                <h6>Premium quality</h6>
               Bookswagon upholds the quality by delivering untarnished books. Quality, services and satisfaction are everything for us!
                                        <i class="fas fa-times-circle" aria-hidden="true" style="position: absolute; right: 5px; top: 5px;"></i>
            </div>
        </div>
        <div class="icon-grid-width text-center">
            <img src="https://www.bookswagon.com/images/icons/easy-return.png">
            <div class="icontextwrap"><span class="a-size-small">Easy Return</span> </div>
             <div class="clickpopup">
                <div class="nav-arrow" style="position: absolute; left: 50%; top: -9px"></div>
                <h6>Easy return</h6>
              Not satisfied with this product! Keep it in original condition and packaging to avail easy return policy. 
                                        <i class="fas fa-times-circle" aria-hidden="true" style="position: absolute; right: 5px; top: 5px;"></i>
            </div>
        </div>

        <div class="icon-grid-width text-center">
            <img src="https://www.bookswagon.com/images/icons/certified-product.png">
            <div class="icontextwrap"><span class="a-size-small">Certified product</span> </div>
              <div class="clickpopup">
                <div class="nav-arrow" style="position: absolute; left: 50%; top: -9px"></div>
                <h6>Certified product</h6>
              First impression is the last impression! Address the book’s certification page, ISBN, publisher’s name, copyright page and print quality.
                                        <i class="fas fa-times-circle" aria-hidden="true" style="position: absolute; right: 5px; top: 5px;"></i>
            </div>

        </div>
        <div class="icon-grid-width text-center">
            <img src="https://www.bookswagon.com/images/icons/secure-express.png">
            <div class="icontextwrap"><span class="a-size-small">Secure Checkout</span> </div>
             <div class="clickpopup">
                <div class="nav-arrow" style="position: absolute; left: 50%; top: -9px"></div>
                <h6>Secure checkout</h6>
             Security at its finest! Login, browse, purchase and pay, every step is safe and secured.
                                        <i class="fas fa-times-circle" aria-hidden="true" style="position: absolute; right: 5px; top: 5px;"></i>
            </div>
        </div>

        <div class="icon-grid-width text-center">
            <img src="https://www.bookswagon.com/images/icons/moneyback-guarantee.png">
            <div class="icontextwrap"><span class="a-size-small">Money back guarantee</span> </div>
            <div class="clickpopup">
                <div class="nav-arrow" style="position: absolute; left: 50%; top: -9px"></div>
                <h6>Money-back guarantee:</h6>
            It’s all about customers! For any kind of bad experience with the product, get your actual amount back after returning the product.
                                        <i class="fas fa-times-circle" aria-hidden="true" style="position: absolute; right: 5px; top: 5px;"></i>
            </div>
        </div>

        <div class="icon-grid-width text-center">
            <img src="https://www.bookswagon.com/images/icons/ontime-delivery.png">
            <div class="icontextwrap"><span class="a-size-small">On time delivery</span> </div>
             <div class="clickpopup">
                <div class="nav-arrow" style="position: absolute; left: 50%; top: -9px"></div>
                <h6>On-time delivery</h6>
           At your doorstep on time! Get this book delivered without any delay.
                                        <i class="fas fa-times-circle" aria-hidden="true" style="position: absolute; right: 5px; top: 5px;"></i>
            </div>
        </div>

    </div>

</div>

    <input type="hidden" name="ctl00$phBody$ProductDetail$hdnISBN" id="ctl00_phBody_ProductDetail_hdnISBN" value="9789395185097">

</div>

<div id="detailcol3">


<div id="bordercornerbox">
    <div class="inside-div">
        <div id="bookavailable">
            <div id="ctl00_phBody_ProductDetail_CartBoxWeb_divAddtoCart">
                <div class="cartboxqty">
                    <span class="d-block mb-2 mt-3">Quantity:
                        <select name="ctl00$phBody$ProductDetail$CartBoxWeb$ddlQty" id="ctl00_phBody_ProductDetail_CartBoxWeb_ddlQty">
		<option value="1">1</option>

    </select>
                    </span>
                </div>

                <!-- Hidden fields for KwikPass -->
                <input type="hidden" name="ctl00$phBody$ProductDetail$CartBoxWeb$hdnProductId" id="ctl00_phBody_ProductDetail_CartBoxWeb_hdnProductId" value="39288152">
                <input type="hidden" name="ctl00$phBody$ProductDetail$CartBoxWeb$hdnProductName" id="ctl00_phBody_ProductDetail_CartBoxWeb_hdnProductName" value="Manual On Recent Clinical Techniques In Veterinary Biochemistry I">
                <input type="hidden" name="ctl00$phBody$ProductDetail$CartBoxWeb$hdnProductPrice" id="ctl00_phBody_ProductDetail_CartBoxWeb_hdnProductPrice" value="1584">

                <!-- Hidden fields for Cart Data (Added for KwikPass) -->
                <input type="hidden" name="ctl00$phBody$ProductDetail$CartBoxWeb$hdnCartId" id="ctl00_phBody_ProductDetail_CartBoxWeb_hdnCartId" value="0">
                <input type="hidden" name="ctl00$phBody$ProductDetail$CartBoxWeb$hdnCartTotalAmount" id="ctl00_phBody_ProductDetail_CartBoxWeb_hdnCartTotalAmount" value="0">
                <input type="hidden" name="ctl00$phBody$ProductDetail$CartBoxWeb$hdnUserLoggedIn" id="ctl00_phBody_ProductDetail_CartBoxWeb_hdnUserLoggedIn" value="false">

                <!-- KwikPass Badge -->


                <div id="ctl00_phBody_ProductDetail_CartBoxWeb_divaction">
                    <a id="btnAddtocart" class="btn themeborder themecolor d-block mb-2" onclick="AddToCartOnProduct(); return false;">Add to Cart</a>
                    <a id="btnGotocart" class="btn themeborder themecolor d-none mb-2" href="https://www.bookswagon.com/shoppingcart.aspx">Go to Cart</a>

                    <!-- Single Dynamic Buy Now Button - Adapts based on KwikPass availability -->
                    <button id="dynamicBuyNow_39288152" class="btn border text-white d-block mb-2 kwikpass-active" onclick="handleDynamicBuyNow(event); return false;" style="background: #ff4c3b; border: none; width: 100%; padding: 6px 12px;border-radius: 20px;font-size: 13px;" type="button" title="Checkout faster">
                        <span class="btn-content">
                            <i class="fas fa-bolt" id="kwikIcon_39288152" style=""></i>
                            <span id="btnText_39288152">Buy Now</span>
                        </span>
                    </button>

                    <label id="lblcartmsg_39288152" class="alert-success"></label>
                </div>
            </div>
        </div>



        <div id="divNotifyMsg" class="notifymebox" style="display: none;">We will notify you once this book available in stock.</div>
        <a class="btn themeborder themecolor d-block mb-2" onclick="AddToWishlist('39288152'); return false;">Add to Wishlist</a>
    </div>

</div>

<div id="ctl00_phBody_ProductDetail_CartBoxWeb_divAppPriceBox" class="apppricebox">
    <div class="apppricebox-main">
        
        <div class="apppricebox-phone" aria-hidden="true">
            <span class="apppricebox-phone-notch"></span>
            <span class="apppricebox-phone-icon">
                <img src="https://www.bookswagon.com/images/staticimages/logo-new.png" alt="">
            </span>
        </div>
        <div class="apppricebox-info">
            <div class="apppricebox-head">Unlock a Better Deal — App Only!</div>
            <div class="apppricebox-sub">Grab it now for just</div>
            <div class="apppricebox-price">
                <span class="apppricebox-amount">
                    ₹1,462</span>
                
                <span class="apppricebox-was apppricebox-hidden">
                    ₹1,584</span>
            </div>
            
            <ul class="apppricebox-breakup apppricebox-hidden">
                <li>
                    Flat 3% app discount (₹47 off)</li>
                <li id="ctl00_phBody_ProductDetail_CartBoxWeb_liAppCoupon">
                    ₹75 app coupon on this order</li>
            </ul>
        </div>
    </div>
    <div class="apppricebox-stores">
        <a class="apppricebox-store apppricebox-applink" rel="noopener" href="https://apps.apple.com/us/app/bookswagon/id6791066008" data-ios-link="https://apps.apple.com/us/app/bookswagon/id6791066008" data-ios-store="https://apps.apple.com/us/app/bookswagon/id6791066008" data-appprice-bound="1" target="_blank">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.36 12.72c.02-2.02 1.65-2.99 1.73-3.03-.94-1.38-2.41-1.57-2.93-1.59-1.25-.13-2.44.73-3.07.73-.63 0-1.61-.71-2.65-.69-1.36.02-2.62.79-3.32 2.01-1.42 2.46-.36 6.1 1.02 8.09.68.98 1.48 2.07 2.54 2.03 1.02-.04 1.4-.66 2.64-.66 1.23 0 1.59.66 2.66.64 1.1-.02 1.79-.99 2.46-1.97.78-1.13 1.09-2.23 1.11-2.29-.02-.01-2.13-.82-2.19-3.27zM14.4 6.7c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37 1.21-.52.6-.97 1.56-.85 2.48.9.07 1.83-.46 2.39-1.13z"></path></svg>
            <span class="apppricebox-store-txt">
                <small>Download on the</small>
                <strong>App Store</strong>
            </span>
        </a>
        <a class="apppricebox-store apppricebox-applink" rel="noopener" href="https://play.google.com/store/search?q=bookswagon&amp;c=apps&amp;hl=en" data-ios-link="https://apps.apple.com/us/app/bookswagon/id6791066008" data-ios-store="https://apps.apple.com/us/app/bookswagon/id6791066008" data-appprice-bound="1" target="_blank">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#34A853" d="M4.3 3.2 14 12.9l-2.6 2.6L3.7 7.8c-.2-.3-.3-.6-.3-1V4.2c0-.5.3-.9.9-1z"></path>
                <path fill="#EA4335" d="M4.3 3.2 17 10.5l-3 1.7L4.3 3.2z"></path>
                <path fill="#FBBC04" d="M17 10.5c.9.5 1.4 1 1.4 1.6s-.5 1.1-1.4 1.6l-3-1.6 3-1.6z"></path>
                <path fill="#4285F4" d="M14 13.7l3 1.7L4.3 22.7 14 13.7z"></path>
            </svg>
            <span class="apppricebox-store-txt">
                <small>Get it on</small>
                <strong>Google Play</strong>
            </span>
        </a>
    </div>
    <script src="https://www.bookswagon.com/js/appprice.js"></script>
</div>

<style>
    .kwikpass-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: kwikpass-spin 1s ease-in-out infinite;
        margin-right: 5px;
        vertical-align: middle;
    }
    
    @keyframes kwikpass-spin {
        to { transform: rotate(360deg); }
    }
    
    .kwikpass-badge {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        margin-top: 5px;
        text-align: center;
        animation: fadeInOut 3s ease-in-out;
    }
    
    @keyframes fadeInOut {regularBuyNow()s
        0% { opacity: 0; transform: translateY(-10px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
    }
    
    .btn-loading {
        opacity: 0.7;
        cursor: not-allowed;
        pointer-events: none;
    }
    
    /* KwikPass active button style */
    .kwikpass-active {
        background: linear-gradient(135deg, #ff4c3b 0%, #e50808 100%) !important;
    }
    
    /* Regular button style */
    .regular-active {
        background: #ff4c3b !important;
    }
</style>

<!-- ========== EXTERNAL KWIKPASS JS FILE ========== -->
<script src="https://www.bookswagon.com/js/kwikpass-integration.js"></script>

<!-- ========== KWIKPASS CONFIGURATION FROM WEB.CONFIG ========== -->
<script type="text/javascript">
    var kwikpassConfig = { environment: 'production', merchantId: '19u2bojshv5u', apiKey: 'C-2-Eqa9jFhp9LCzffEWRi6seQPhlXZaIdWyxgl4cWA', scriptUrl: 'https://pdp.gokwik.co/kwikpass/plugin/build/kp-custom-merchant.js', logoUrl: 'https://pdp.gokwik.co/kwikpass/assets/icons/kwik_pass_logo.svg', baseUrl: 'https://pdp.gokwik.co', isEnabled: true, isInternational: false };
    //console.log('KwikPass Config Loaded:', kwikpassConfig);
</script>

<!-- ========== PRODUCT DATA ========== -->
<script type="text/javascript">
    var currentProduct_39288152 = {
        id: '39288152',
        name: 'Manual On Recent Clinical Techniques In Veterinary Biochemistry I',
        price: 1584,
        vendorId: '36',
        productType: '1'
    };
</script>

<!-- ========== ORIGINAL GOKWIK INTEGRATION (COMPLETELY PRESERVED) ========== -->
<script type="text/javascript">
    $(document).ready(function () {
        //console.log('=== GoKwik Integration Starting ===');

        // Get cart data and ENSURE it's a NUMBER
        var rawCartId = '0';
        var numericCartId = parseInt(rawCartId, 10);

        if (isNaN(numericCartId)) {
            console.error('Invalid cart ID:', rawCartId);
            numericCartId = 0;
        }

        var cartTotal = parseFloat($('#cartTotalAmount').val()) || 0;

        //console.log('✅ CORRECT CART ID:', numericCartId, 'Type:', typeof numericCartId);
        //console.log('Cart Total:', cartTotal);

        // STORE CORRECT ID GLOBALLY and FREEZE it
        window.__GOKWIK_CART_ID = numericCartId;

        // PREVENT ANY CHANGES to the cart ID
        Object.defineProperty(window, 'GOKWIK_CART_ID', {
            get: function () { return numericCartId; },
            set: function (value) {
                console.warn('🛑 Blocked attempt to change cart ID to:', value);
                return numericCartId;
            },
            configurable: false
        });

        // INTERCEPT all events to fix cart_id
        (function () {
            var originalDispatch = window.dispatchEvent;
            window.dispatchEvent = function (event) {
                // Fix cart_id in page_view_kp events
                if (event && event.type === 'page_view_kp' && event.detail && event.detail.data) {
                    if (event.detail.data.cart_id !== numericCartId) {
                        console.warn('🛑 Fixed wrong cart_id in event:', event.detail.data.cart_id, '→', numericCartId);
                        event.detail.data.cart_id = numericCartId;
                    }
                }
                // Fix cartId in any event
                if (event && event.cartId && event.cartId !== numericCartId) {
                    event.cartId = numericCartId;
                }
                return originalDispatch.call(this, event);
            };
        })();

        // Disable button if cart is empty
        if (cartTotal <= 0) {
            $('#btnGoKwikCheckout').prop('disabled', true).css('opacity', '0.5');
        }

        // Initialize GoKwik when SDK is ready
        function initGoKwik() {
            if (typeof gokwikSdk !== 'undefined') {
                try {
                    //console.log('GoKwik SDK loaded, initializing with cart ID:', numericCartId);

                    // Store SDK in global
                    window.gokwikSdk = gokwikSdk;

                    // PATCH SDK METHODS to ensure correct cart ID
                    if (gokwikSdk.sendEvent) {
                        var originalSendEvent = gokwikSdk.sendEvent;
                        gokwikSdk.sendEvent = function (eventName, data) {
                            if (data && data.cartId) {
                                data.cartId = numericCartId;
                            }
                            return originalSendEvent.call(this, eventName, data);
                        };
                    }

                    // Set up event listeners
                    if (typeof gokwikSdk.on === 'function') {
                        gokwikSdk.on('checkout-initiation-failure', function (error) {
                            console.error('Checkout failure:', error);
                            //alert('Checkout failed. Please try regular checkout.');
                            regularBuyNow()
                        });

                        gokwikSdk.on('order-complete', function (order) {
                            //console.log('Order complete:', order);
                            window.location.href = '/orderconfirmation.aspx?oid=' + (order.merchant_order_id || '');
                        });
                    }

                    //console.log('✅ GoKwik SDK ready');

                } catch (error) {
                    console.error('GoKwik setup error:', error);
                }
            } else {
                //console.log('Waiting for GoKwik SDK...');
            }
        }

        // Check for SDK
        if (typeof gokwikSdk !== 'undefined') {
            initGoKwik();
        } else {
            var checkInterval = setInterval(function () {
                if (typeof gokwikSdk !== 'undefined') {
                    clearInterval(checkInterval);
                    initGoKwik();
                }
            }, 200);

            setTimeout(function () {
                clearInterval(checkInterval);
            }, 10000);
        }

        // Button click handler
        $('#btnGoKwikCheckout').on('click', function (e) {
            e.preventDefault();

            if (cartTotal <= 0) {
                alert('Your cart is empty');
                return;
            }

            if (typeof gokwikSdk === 'undefined') {
                alert('Payment service loading...');
                return;
            }

            try {
                //console.log('Opening GoKwik checkout with cart ID:', numericCartId);

                // THIS OPENS THE POPUP
                gokwikSdk.initCheckout({
                    environment: kwikpassConfig.environment,
                    type: 'merchantInfo',
                    mid: kwikpassConfig.merchantId,
                    merchantParams: {
                        merchantCheckoutId: numericCartId  // CORRECT - sending as NUMBER
                    }
                });

                //console.log('✅ Checkout initiated - popup should open');

            } catch (error) {
                console.error('Checkout error:', error);
                alert('Failed to open checkout: ' + error.message);
            }
        });

        // Track page view for KwikPass with CORRECT cart ID
        setTimeout(function () {
            try {
                var event = new CustomEvent('page_view_kp', {
                    detail: {
                        type: 'cart',
                        data: {
                            cart_id: numericCartId,  // USING CORRECT NUMERIC ID
                            page_url: window.location.pathname,
                            cart_total: cartTotal
                        }
                    }
                });
                window.dispatchEvent(event);
                //console.log('✅ KwikPass tracked with cart ID:', numericCartId);
            } catch (error) {
                console.error('Tracking error:', error);
            }
        }, 1000);

        //console.log('=== GoKwik Integration Complete ===');
        //console.log('✅ FINAL - Using cart ID:', numericCartId);

        window.startGoKwikCheckout = function () {
            var amount = document.getElementById('cartTotalAmount').value;
            var cartTotal = parseFloat(amount) || 0;

            //console.log('Starting checkout with amount:', cartTotal);
            //console.log('Using cart ID:', window.GOKWIK_CART_ID);

            if (cartTotal <= 0) {
                alert('Your cart is empty.');
                return false;
            }

            if (typeof gokwikSdk === 'undefined') {
                alert('GoKwik SDK not loaded yet.');
                return false;
            }

            try {
                // 🚀 THIS ACTUALLY OPENS THE POPUP
                gokwikSdk.openCheckout();
                //console.log('✅ GoKwik checkout popup opened');
            } catch (error) {
                console.error('Checkout error:', error);
                alert('Checkout failed: ' + error.message);
            }

            return false;
        };
    });
</script>

<!-- ========== PREVENT ANY WRONG CART ID EVENTS (PRESERVED) ========== -->
<script type="text/javascript">
    // Block any events with wrong cart ID
    (function () {
        var originalDispatch = window.dispatchEvent;

        window.dispatchEvent = function (event) {
            // If this is a page_view_kp event with wrong cart_id, fix it
            if (event.type === 'page_view_kp' && event.detail && event.detail.data) {
                if (event.detail.data.cart_id !== window.GOKWIK_CART_ID) {
                    console.warn('🛑 Fixed wrong cart ID in event:', event.detail.data.cart_id, '→', window.GOKWIK_CART_ID);
                    event.detail.data.cart_id = window.GOKWIK_CART_ID;
                }
            }
            return originalDispatch.call(this, event);
        };

        //console.log('🛡️ Event interceptor active');
    })();
</script>

<!-- ========== KWIKPASS INTEGRATION (ADDED - USES EXTERNAL JS) ========== -->
<script type="text/javascript">
    $(document).ready(function () {
        //console.log('=== KwikPass Integration Starting (External JS) ===');

        // Get values from hidden fields (added without affecting existing)
        var cartId = $('#ctl00_phBody_ProductDetail_CartBoxWeb_hdnCartId').val() || '0';
        var cartTotal = parseFloat($('#ctl00_phBody_ProductDetail_CartBoxWeb_hdnCartTotalAmount').val()) || 0;
        var isLoggedIn = $('#ctl00_phBody_ProductDetail_CartBoxWeb_hdnUserLoggedIn').val() === 'true';

        //console.log('KwikPass - Cart ID:', cartId, 'Total:', cartTotal, 'Logged In:', isLoggedIn);

        // Update KwikPass config if the external object exists
        if (window.KwikPass) {
            KwikPass.updateConfig({
                cartId: cartId,
                cartTotal: cartTotal,
                isLoggedIn: isLoggedIn
            });
            //console.log('✅ KwikPass config updated from external JS');
        } else {
            console.warn('⚠️ KwikPass external JS not loaded yet');

            // Wait for it to load
            var waitForKwikPass = setInterval(function () {
                if (window.KwikPass) {
                    clearInterval(waitForKwikPass);
                    KwikPass.updateConfig({
                        cartId: cartId,
                        cartTotal: cartTotal,
                        isLoggedIn: isLoggedIn
                    });
                    //console.log('✅ KwikPass loaded and config updated');
                }
            }, 100);

            setTimeout(function () { clearInterval(waitForKwikPass); }, 5000);
        }
    });
</script>
<!-- ========== END KWIKPASS INTEGRATION ========== -->
<!-- ========== CARTBOX DYNAMIC BUY NOW FUNCTIONALITY ========== -->
<script type="text/javascript">
    // ========== GLOBAL VARIABLES ==========
    var isProcessingKwikPass = false;
    var isKwikPassAvailable = false;
    var RootPath = 'https://www.bookswagon.com';
    var sdkCheckInterval = null;
    var sdkCheckAttempts = 0;
    var maxCheckAttempts = 20; // Check for up to 10 seconds (20 * 500ms)

    // ========== Flag to prevent popup on GoKwik errors ==========
    var preventPopupOpening = false;

    // ========== ORIGINAL FUNCTIONS (PRESERVED) ==========
    function AddToCartOnProduct() {
        var productId = '39288152';
        var vendorId = '36';
        var e = document.getElementById("ctl00_phBody_ProductDetail_CartBoxWeb_ddlQty");
        var qty = e.options[e.selectedIndex].value;
        var productType = '1';
        AddtoCart(productId, qty, vendorId, productType);
        showKwikPassBadge('39288152');
    }

    function regularBuyNow() {
        var productId = '39288152';
        var vendorId = '36';
        var e = document.getElementById("ctl00_phBody_ProductDetail_CartBoxWeb_ddlQty");
        var qty = e.options[e.selectedIndex].value;
        var productType = '1';
        location.href = RootPath + '/shippingoption.aspx?pid=' + productId + '&vid=' + vendorId + '&ptype=' + productType + '&qty=' + qty;
    }

    // ========== DYNAMIC BUTTON HANDLER ==========
    function updateButtonForKwikPass() {
        var $btn = $('#dynamicBuyNow_39288152');
        var $icon = $('#kwikIcon_39288152');
        var $btnText = $('#btnText_39288152');
        
        if (isKwikPassAvailable && kwikpassConfig.isEnabled) {
            $btn.addClass('kwikpass-active').removeClass('regular-active');
            $icon.show();
            $btnText.text('Buy Now');
            $btn.attr('title', 'Checkout faster');
        } else {
            $btn.addClass('regular-active').removeClass('kwikpass-active');
            $icon.hide();
            $btnText.text('Buy Now');
            $btn.attr('title', 'Regular checkout');
        }
    }

    function checkKwikPassSDK() {
        // If KwikPass is disabled in config, don't even check
        if (!kwikpassConfig.isEnabled) {
            if (sdkCheckInterval) {
                clearInterval(sdkCheckInterval);
                sdkCheckInterval = null;
            }
            isKwikPassAvailable = false;
            updateButtonForKwikPass();
            
            var statusEl = document.getElementById('sdkStatus');
            if (statusEl) {
                //statusEl.innerHTML = 'ℹ️ KwikPass Disabled in Config';
                statusEl.style.color = '#666';
            }
            return false;
        }

        if (typeof gokwikSdk !== 'undefined') {
            isKwikPassAvailable = true;
            updateButtonForKwikPass();
            
            if (sdkCheckInterval) {
                clearInterval(sdkCheckInterval);
                sdkCheckInterval = null;
            }
            
            var statusEl = document.getElementById('sdkStatus');
            if (statusEl) {
                //statusEl.innerHTML = '✅ KwikPass Ready (' + kwikpassConfig.environment + ')';
                statusEl.style.color = 'green';
            }
            
            return true;
        }
        
        sdkCheckAttempts++;
        
        var statusEl = document.getElementById('sdkStatus');
        if (statusEl) {
            statusEl.innerHTML = '⏳ Loading KwikPass... (' + sdkCheckAttempts + '/' + maxCheckAttempts + ')';
            statusEl.style.color = '#666';
        }
        
        if (sdkCheckAttempts >= maxCheckAttempts) {
            if (sdkCheckInterval) {
                clearInterval(sdkCheckInterval);
                sdkCheckInterval = null;
            }
            
            isKwikPassAvailable = false;
            updateButtonForKwikPass();
            
            if (statusEl) {
                statusEl.innerHTML = 'ℹ️ KwikPass unavailable - using regular checkout';
                statusEl.style.color = '#666';
            }
        }
        
        return false;
    }

    function handleDynamicBuyNow(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Reset preventPopup flag on new click
        preventPopupOpening = false;

        if (isKwikPassAvailable && kwikpassConfig.isEnabled) {
            if (0 != 0) {
                handleKwikPassBuyNow(event);
            } else {
                sessionStorage.setItem("returnUrl", window.location.href);
                location.href = RootPath + '/Login.aspx';
                return false;
            }
        } else {
            regularBuyNow();
        }

        return false;
    }

    // ========== KWIKPASS FUNCTIONS - FIXED TO HANDLE GOKWIK API ERRORS ==========
    function handleKwikPassBuyNow(event) {
        if (isProcessingKwikPass) {
            return false;
        }

        isProcessingKwikPass = true;

        var e = document.getElementById("ctl00_phBody_ProductDetail_CartBoxWeb_ddlQty");
        if (!e) {
            isProcessingKwikPass = false;
            regularBuyNow();
            return false;
        }

        var qty = parseInt(e.options[e.selectedIndex].value) || 1;
        var product = currentProduct_39288152;

        var $btn = $('#dynamicBuyNow_39288152');
        var originalContent = $btn.html();
        $btn.html('<span class="kwikpass-spinner"></span> Processing...').prop('disabled', true).addClass('btn-loading');

        $('.full-loader').fadeIn();

        addProductToCartViaAjax(product.id, qty, product.vendorId, product.productType, function(success, response) {
            if (!success) {
                $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                $('.full-loader').fadeOut();
                isProcessingKwikPass = false;
                
                // Check for 500 Internal Server Error from your API
                if (response && response.httpStatus === 500) {
                    console.log('500 Internal Server Error from your API - redirecting to regular checkout');
                    preventPopupOpening = true;
                    regularBuyNow();
                    return;
                }
                
                alert('Failed to add product. Please try again.');
                return;
            }

            // Check if we should prevent popup
            if (preventPopupOpening) {
                console.log('Popup prevented due to previous error');
                $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                $('.full-loader').fadeOut();
                isProcessingKwikPass = false;
                regularBuyNow();
                return;
            }

            var combinedCartId = response.combinedCartId || response.cartId + '||true';

            if (response.totalQuantity) {
                var totalItemsEl = document.getElementById("ctl00_lblTotalCartItems");
                var mobileCountEl = document.getElementById("ctl00_lblMobileCartCount");
                if (totalItemsEl) totalItemsEl.innerHTML = response.totalQuantity;
                if (mobileCountEl) mobileCountEl.innerHTML = response.totalQuantity;
            }

            if (typeof gokwikSdk === 'undefined') {
                $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                $('.full-loader').fadeOut();
                isProcessingKwikPass = false;
                
                if (confirm('KwikPass not available. Use regular checkout?')) {
                    regularBuyNow();
                }
                return;
            }

            // Set up ALL possible error handlers BEFORE initCheckout
            if (typeof gokwikSdk.on === 'function') {
                // Remove any existing listeners to avoid duplicates
                try {
                    gokwikSdk.off('checkout-initiation-failure');
                    gokwikSdk.off('error');
                } catch (e) {
                    // Ignore if off doesn't exist
                }
                
                // Handle checkout initiation failure
                gokwikSdk.on('checkout-initiation-failure', function(error) {
                    console.log('checkout-initiation-failure event triggered - redirecting to regular checkout');
                    
                    if (!preventPopupOpening) {
                        preventPopupOpening = true;
                        $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                        $('.full-loader').fadeOut();
                        isProcessingKwikPass = false;
                        regularBuyNow();
                    }
                });

                // Handle general errors (including GoKwik API 500 errors)
                gokwikSdk.on('error', function(error) {
                    console.log('GoKwik error event triggered - redirecting to regular checkout', error);
                    
                    // Check if it's a 500 error or any other error
                    if (error && (error.status === 500 || error.message?.includes('500') || error.error?.includes('500'))) {
                        console.log('GoKwik 500 error detected - redirecting to regular checkout');
                        
                        if (!preventPopupOpening) {
                            preventPopupOpening = true;
                            $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                            $('.full-loader').fadeOut();
                            isProcessingKwikPass = false;
                            regularBuyNow();
                        }
                    }
                });
            }

            // Override the fetch/XHR to catch API errors (advanced technique)
            var originalFetch = window.fetch;
            if (originalFetch) {
                window.fetch = function() {
                    var fetchPromise = originalFetch.apply(this, arguments);
                    
                    // Check if this is a GoKwik API call
                    var url = arguments[0];
                    if (typeof url === 'string' && (url.includes('gokwik') || url.includes('kwikpass'))) {
                        return fetchPromise.then(function(response) {
                            if (response.status === 500) {
                                console.log('GoKwik API 500 error intercepted - redirecting to regular checkout');
                                
                                if (!preventPopupOpening) {
                                    preventPopupOpening = true;
                                    setTimeout(function() {
                                        $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                                        $('.full-loader').fadeOut();
                                        isProcessingKwikPass = false;
                                        regularBuyNow();
                                    }, 100);
                                }
                            }
                            return response;
                        });
                    }
                    return fetchPromise;
                };
            }

            try {
                // Only open popup if not prevented
                if (!preventPopupOpening) {
                    //console.log('Opening GoKwik checkout with cart ID:', combinedCartId);
                    
                    gokwikSdk.initCheckout({
                        environment: kwikpassConfig.environment,
                        type: 'merchantInfo',
                        mid: kwikpassConfig.merchantId,
                        merchantParams: {
                            merchantCheckoutId: combinedCartId
                        }
                    });
                    
                    // Set a timeout to check if popup opened successfully
                    setTimeout(function() {
                        // If still processing and no error, check if popup is visible
                        if (isProcessingKwikPass && !preventPopupOpening) {
                            // Check if popup is visible (you might need to adjust this selector)
                            var popupVisible = $('.gokwik-popup, [class*="gokwik"], [class*="kwikpass"]').is(':visible');
                            
                            if (!popupVisible) {
                                //console.log('Popup may not have opened - checking status');
                                // Don't redirect immediately, give it a little more time
                            }
                        }
                    }, 2000);
                    
                    // Reset button after 3 seconds (original behavior)
                    setTimeout(function() {
                        if (!preventPopupOpening) {
                            $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                            $('.full-loader').fadeOut();
                            isProcessingKwikPass = false;
                        }
                    }, 3000);
                } else {
                    // If prevented, just redirect
                    //console.log('Popup opening prevented - redirecting to regular checkout');
                    $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                    $('.full-loader').fadeOut();
                    isProcessingKwikPass = false;
                    regularBuyNow();
                }
                
            } catch (error) {
                console.log('GoKwik initialization error:', error);
                $btn.html(originalContent).prop('disabled', false).removeClass('btn-loading');
                $('.full-loader').fadeOut();
                isProcessingKwikPass = false;

                // Check if error is related to 500
                if (error.message?.includes('500') || error.status === 500) {
                    console.log('500 error in initialization - redirecting');
                    regularBuyNow();
                } else {
                    if (confirm('Checkout failed. Use regular checkout?')) {
                        regularBuyNow();
                    }
                }
            }
        });

        return false;
    }

    // ========== AJAX FUNCTION (UNCHANGED) ==========
    function addProductToCartViaAjax(productId, quantity, vendorId, productType, callback) {
        var param = JSON.stringify({
            productId: productId,
            quantity: quantity,
            productTypeId: productType,
            vendorId: vendorId,
            isBuyNow: "true"
        });

        $.ajax({
            type: "POST",
            url: RootPath + "/ajax.aspx/AddBasketItemForKwikPass",
            data: param,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(response) {
                try {
                    if (response.d) {
                        var responseData = typeof response.d === 'string' ? JSON.parse(response.d) : response.d;
                        callback(responseData.success, responseData);
                    } else {
                        callback(false, { httpStatus: 500 });
                    }
                } catch (e) {
                    callback(false, { httpStatus: 500 });
                }
            },
            error: function(xhr, status, error) {
                // Check if it's a 500 Internal Server Error
                if (xhr.status === 500) {
                    callback(false, { httpStatus: 500 });
                } else {
                    callback(false, null);
                }
            }
        });
    }

    //function showKwikPassBadge(productId) {
    //    var badge = document.getElementById('kwikpassBadge_' + productId);
    //    if (badge) {
    //        badge.style.display = 'block';
    //        setTimeout(function() { badge.style.display = 'none'; }, 3000);
    //    }
    //}

    // Document ready
    $(document).ready(function() {
        // Set hidden field values
        $('#ctl00_phBody_ProductDetail_CartBoxWeb_hdnProductId').val('39288152');
        $('#ctl00_phBody_ProductDetail_CartBoxWeb_hdnProductName').val('Manual On Recent Clinical Techniques In Veterinary Biochemistry I');
        $('#ctl00_phBody_ProductDetail_CartBoxWeb_hdnProductPrice').val('1584');

        // Start checking for KwikPass SDK
        checkKwikPassSDK();
        
        if (kwikpassConfig.isEnabled) {
            sdkCheckInterval = setInterval(checkKwikPassSDK, 500);
        }

        // Click handler for dynamic button
        $('#dynamicBuyNow_39288152').off('click').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            handleDynamicBuyNow(e);
            return false;
        });

        $(window).on('beforeunload', function () {
            if (sdkCheckInterval) {
                clearInterval(sdkCheckInterval);
            }

            // Restore original fetch if we overrode it
            if (window.originalFetch) {
                window.fetch = window.originalFetch;
            }
        });
    });
</script>
<!-- Simple status display -->
<!-- SDK Status Display - Only shown in non-production when enabled -->

</div>

<!-- SHARE FUNCTIONALITY STYLES -->
<style>
    /* SHARE POPUP STYLES - PRIORITY OVERRIDES */
    #detailcol1 .share-icon {
        position: absolute !important;
        top: 10px !important;
        right:-43px !important;
        cursor: pointer !important;
        z-index: 9 !important;
        background: white !important;
        border-radius: 50% !important;
        width: 40px !important;
        height: 40px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.3s ease !important;
    }

    .share-icon:hover {
        background: #f8f8f8 !important;
        transform: scale(1.05) !important;
    }

     #detailcol1 .share-icon img {
        width: 30px !important;
        height: 30px !important;
        min-height:inherit;
    }

    /* SHARE POPUP CONTAINER - FIXED POSITIONING */
    #sharePopup {
        display: none !important; /* Start hidden */
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0,0,0,0.7) !important;
        z-index: 1000000 !important; /* Ultra high z-index */
        opacity: 0 !important;
        transition: opacity 0.3s ease !important;
    }

    #sharePopup.show {
        display: block !important;
        opacity: 1 !important;
    }

    /* POPUP INNER CONTENT */
    .share-popup-inner {
        background: #fff !important;
        width: 90% !important;
        max-width: 400px !important;
        margin: 100px auto !important;
        padding: 25px !important;
        border-radius: 12px !important;
        text-align: center !important;
        position: relative !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
        transform: translateY(-20px) !important;
        transition: transform 0.3s ease !important;
        z-index: 1000001 !important;

    }

    #sharePopup.show .share-popup-inner {
        transform: translateY(0) !important;
    }

    .share-popup-inner h6 {
        margin: 0 0 20px 0 !important;
        color: #333 !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        padding-bottom: 15px !important;
        border-bottom: 1px solid #eee !important;
    }

    /* SHARE BUTTONS */
    .share-btn {
        display: flex !important;
        align-items: center !important;
        margin: 10px 0 !important;
        padding: 12px 15px !important;
        color: #333 !important;
        text-decoration: none !important;
        background: #f8f9fa !important;
        border-radius: 8px !important;
        transition: all 0.2s ease !important;
        font-size: 15px !important;
        font-weight: 500 !important;
        border: none !important;
        width: 100% !important;
        text-align: left !important;
        cursor: pointer !important;
    }

    .share-btn:hover {
        background: #e9ecef !important;
        transform: translateX(5px) !important;
        box-shadow: 0 3px 8px rgba(0,0,0,0.1) !important;
    }

    .share-btn svg {
        width: 20px !important;
        height: 20px !important;
        margin-right: 10px !important;
    }

    /* COPY LINK SECTION */
    .copy-link-section {
        margin-top: 25px !important;
        padding-top: 20px !important;
        border-top: 1px solid #eee !important;
    }

    .copy-row {
        display: flex !important;
        gap: 8px !important;
        margin-bottom: 10px !important;
    }

    #shareLinkInput {
        flex: 1 !important;
        font-size: 14px !important;
        padding: 10px 12px !important;
        border: 1px solid #ddd !important;
        border-radius: 6px !important;
        background: #f9f9f9 !important;
        font-family: monospace !important;
        color: #333 !important;
        min-width: 0 !important;
    }

    #shareLinkInput:focus {
        outline: none !important;
        border-color: #2874f0 !important;
        box-shadow: 0 0 0 2px rgba(40, 116, 240, 0.1) !important;
    }

    .copy-btn {
        background: #2874f0 !important;
        color: white !important;
        border: none !important;
        padding: 10px 18px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        white-space: nowrap !important;
        min-width: 80px !important;
    }

    .copy-btn:hover {
        background: #1a5fc1 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 3px 8px rgba(40, 116, 240, 0.3) !important;
    }

    .copy-btn:active {
        transform: translateY(0) !important;
    }

    /* COPY STATUS */
    .copy-status {
        display: none !important;
        color: #28a745 !important;
        font-size: 14px !important;
        margin-top: 10px !important;
        align-items: center !important;
        justify-content: center !important;
        animation: fadeInOut 2s ease !important;
    }

    @keyframes fadeInOut {
        0%, 100% {
            opacity: 0 !important;
            transform: translateY(-5px) !important;
        }
        10%, 90% {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    }

    /* CLOSE BUTTON */
    .share-close-btn {
        position: absolute !important;
        top: 15px !important;
        right: 15px !important;
        background: none !important;
        border: none !important;
        font-size: 24px !important;
        cursor: pointer !important;
        color: #666 !important;
        padding: 0 !important;
        width: 30px !important;
        height: 30px !important;
        line-height: 1 !important;
        border-radius: 50% !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 1000002 !important;
    }

    .share-close-btn:hover {
        background: #f5f5f5 !important;
        color: #333 !important;
    }

    /* RESPONSIVE */
    @media (max-width: 768px) {
        .share-popup-inner {
            width: 95% !important;
            margin: 80px auto !important;
            padding: 20px !important;
        }

        #detailcol1  .share-icon {
            width: 36px !important;
            height: 36px !important;
            top: 8px !important;
            right: 8px !important;
        }

        .share-icon svg {
            width: 18px !important;
            height: 18px !important;
        }

        .share-btn {
            padding: 10px 12px !important;
            font-size: 14px !important;
        }

        .copy-btn {
            padding: 10px 15px !important;
            font-size: 13px !important;
        }
    }

    @media (max-width: 480px) {
        .share-popup-inner {
            margin: 60px auto !important;
            padding: 15px !important;
        }

        .copy-row {
            flex-direction: column !important;
        }

        .copy-btn {
            width: 100% !important;
            margin-top: 8px !important;
        }
    }

    /* EMERGENCY OVERRIDE - Prevent other styles from hiding popup */
    .share-popup[style*="display: none"],
    .share-popup.hide,
    .share-popup.hidden {
        display: block !important;
        opacity: 1 !important;
    }
    
    /* Force popup to stay on top */
    body.share-popup-open {
        overflow: hidden !important;
    }
</style>

<!-- SHARE FUNCTIONALITY JAVASCRIPT -->
<script type="text/javascript">
    // SHARE FUNCTIONALITY - ISOLATED FROM OTHER SCRIPTS
    (function () {
        'use strict';

        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initShare);
        } else {
            initShare();
        }

        function initShare() {
            console.log('Initializing share functionality...');

            // SHARE BUTTON CLICK - Open popup
            document.getElementById('btnShareProduct').addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                openSharePopup();
            });

            // CLOSE BUTTON
            document.querySelector('.share-close-btn').addEventListener('click', function (e) {
                e.stopPropagation();
                closeSharePopup();
            });

            // COPY LINK BUTTON
            document.getElementById('copyLinkBtn').addEventListener('click', function (e) {
                e.stopPropagation();
                copyLinkToClipboard();
            });

            // Setup individual share buttons WITHOUT preventing default
            setupShareButton('shareWhatsapp');
            setupShareButton('shareFacebook');
            setupShareButton('shareTwitter');
            setupShareButton('shareLinkedin');
            setupShareButton('shareEmail');

            // Close popup when clicking on overlay (outside content)
            document.getElementById('sharePopup').addEventListener('click', function (e) {
                if (e.target === this) {
                    closeSharePopup();
                }
            });

            // Close with Escape key
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && document.getElementById('sharePopup').classList.contains('show')) {
                    closeSharePopup();
                }
            });
        }

        function setupShareButton(buttonId) {
            var button = document.getElementById(buttonId);
            if (button) {
                // Remove ALL existing click handlers
                var newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);

                // NO click handler added - let the href work naturally
                // The link will open in new tab as defined in HTML
            }
        }

        function openSharePopup() {
            console.log('Opening share popup');

            // Get current page URL and product details
            var pageUrl = window.location.href.split('#')[0];
            var title = document.getElementById('lblTitle') ?
                document.getElementById('lblTitle').textContent.trim() :
                document.title;
            var author = document.getElementById('lblAuthor1') ?
                document.getElementById('lblAuthor1').textContent.trim() : '';
            var price = document.getElementById('lblourPrice') ?
                document.getElementById('lblourPrice').textContent.trim() : '';

            // Prepare share text (for WhatsApp)
            var shareText = title;
            if (author) shareText += ' by ' + author;
            if (price) shareText += ' - ' + price;
            shareText += ' ' + pageUrl;

            // Set the link in the input field for copying
            document.getElementById('shareLinkInput').value = pageUrl;

            // UPDATE ALL SHARE LINKS DIRECTLY
            updateShareLinks(pageUrl, title, shareText);

            // Show the popup
            var popup = document.getElementById('sharePopup');
            popup.classList.add('show');
            document.body.classList.add('share-popup-open');
        }

        function updateShareLinks(pageUrl, title, shareText) {
            // Encode for URLs
            var encodedUrl = encodeURIComponent(pageUrl);
            var encodedText = encodeURIComponent(shareText);
            var encodedTitle = encodeURIComponent(title);

            // WhatsApp - direct link (will open in WhatsApp app on mobile)
            document.getElementById('shareWhatsapp').href =
                'https://api.whatsapp.com/send?text=' + encodedText;

            // Facebook - direct share dialog
            document.getElementById('shareFacebook').href =
                'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '&quote=' + encodedTitle;

            // Twitter - direct tweet intent
            document.getElementById('shareTwitter').href =
                'https://twitter.com/intent/tweet?text=' + encodedTitle + '&url=' + encodedUrl;

            // LinkedIn - direct share
            document.getElementById('shareLinkedin').href =
                'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl;

            // Email - mailto link
            document.getElementById('shareEmail').href =
                'mailto:?subject=' + encodedTitle + '&body=' + encodedText;
        }

        function closeSharePopup() {
            document.getElementById('sharePopup').classList.remove('show');
            document.body.classList.remove('share-popup-open');
        }

        function copyLinkToClipboard() {
            var copyText = document.getElementById("shareLinkInput");
            copyText.select();
            copyText.setSelectionRange(0, 99999);

            // Copy using modern API or fallback
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(copyText.value)
                    .then(function () {
                        showCopySuccess();
                    })
                    .catch(function (err) {
                        // Fallback
                        document.execCommand('copy');
                        showCopySuccess();
                    });
            } else {
                // Fallback for older browsers
                document.execCommand('copy');
                showCopySuccess();
            }
        }

        function showCopySuccess() {
            var copyStatus = document.getElementById('copyStatus');
            copyStatus.style.display = 'flex';
            setTimeout(function () {
                copyStatus.style.display = 'none';
            }, 2000);
        }
    })();
</script>
<script language="javascript" type="text/javascript">
    function CountryLookUp(id) {
        document.getElementById(id).style.display = 'block';
    }
    function CloseDiv(id) {
        document.getElementById(id).style.display = 'none';
    }


    $(document).on("click", ".readallreview", function () {
        $('html, body').animate({

            scrollTop: $("#customerreviewsection").offset().top - 100

        }, 2000);
        ReviewCall();
    })


    /* About the Book: clamped to two lines, expands in place.
       The handler is delegated off document so it survives any later re-render,
       and the "does it already fit?" check only ever runs while the block is
       still collapsed and untouched by the user. */
    $(document).on("click", "#aboutbooktoggle", function (e) {
        e.preventDefault();
        var $body = $("#aboutbookbody");
        var collapsing = !$body.hasClass("aboutbook-collapsed");

        $body.toggleClass("aboutbook-collapsed", collapsing);
        $(this).text(collapsing ? "read more" : "read less").data("touched", true);

        if (collapsing) {
            // keep the heading in view rather than stranding the user further down
            var top = $("#aboutbook").offset().top - 120;
            if ($(window).scrollTop() > top) $('html, body').animate({ scrollTop: top }, 200);
        }
    });

    function bwAboutBookSync() {
        var $body = $("#aboutbookbody");
        var $toggle = $("#aboutbooktoggle");
        if (!$body.length || !$toggle.length) return;
        if ($toggle.data("touched")) return;              // user is driving it now
        if (!$body.hasClass("aboutbook-collapsed")) return;

        // Nothing is being cut off -> drop the clamp and the link, so the link is
        // never shown as a toggle that would do nothing.
        var clipped = $body[0].scrollHeight > $body[0].clientHeight + 2;
        $toggle.toggle(clipped);
        if (!clipped) $body.removeClass("aboutbook-collapsed");
    }

    $(function () { bwAboutBookSync(); });
    $(window).on("load resize", bwAboutBookSync);
    var discountperc = $("#detailcol1 .offer").text();
    var originalpriceval = $(".originalprice").text();
    var maxpricedetailval = $(".maxpricedetail").text();
    if (discountperc != "") {
        $(".savingPriceOverride").text("-" + discountperc);
    }

    $(".a-price").text(originalpriceval);
    $(".maxpricedetailmob").text(maxpricedetailval);

    $(document).ready(function () {
        var $thumbs = $('.thumbslide li');
        var count = $thumbs.length;

        if (count > 2) {
            // Hide all first
            $thumbs.hide();

            // Show only the first 2 li
            $thumbs.slice(0, 2).show();

            // Remove any previously added "+X" li
            $('.thumbslide li.more-count').remove();

            // Append new li with remaining count
            $('.thumbslide ul').append(
                '<li class="more-count">+' + (count - 2) + '</li>'
            );
        }

        // Make visible after setup
        $('.thumbslide').css("opacity", '1');
    });


    $(document).on("click", ".thumbslide li:lt(2)", function () { var cdf = $(this).find("img").attr("src"); $(".thumbslide li").removeClass('activemulti'); $('.bigimg img').attr('src', cdf); $(this).addClass('activemulti'); $('.bigimg img').attr('data-zoom-image', cdf) });
    if ($('.thumbslide li').length > 0) {
        $('.thumbslide li:eq(0)').addClass('activemulti');
        $(document).on("click", ".bigimg", function () {
            $(".thumbwrapper ul li").removeClass('activepopupthumb');
            var mgh1 = $(".activemulti").index();
            $(".productzoompopup").show();
            $(".darkbg-cover").show();
            $('.mobilepopupslider .owl-dot').eq(mgh1).trigger('click');
            $(".thumbwrapper ul li").eq(mgh1).addClass('activepopupthumb');

        });
    }
    else {
        $(document).on("click", ".bigimg", function () {
            $(".productzoompopup").show();
            $(".darkbg-cover").show();
            $(".singlevariantprod").show();
        });
    }

    $(document).on("click", ".thumbslide li:last-child", function () {
        $(".productzoompopup").show();
        $(".darkbg-cover").show();
        var kkk = $(".thumbslide li.activemulti").index();
        $('.mobilepopupslider .owl-dot').eq(kkk).trigger('click');
    });

    $(document).on("click", ".productslider .owl-item.active", function () {
        var mgh = $(this).index();
        $(".thumbwrapper ul li").removeClass('activepopupthumb')
        $(".productzoompopup").show();
        $(".darkbg-cover").show();
        $('.mobilepopupslider').trigger('to.owl.carousel', [mgh, 0, true]);
        $(".thumbwrapper ul li").removeClass('activethumb');
        $(".thumbwrapper ul li").eq(mgh).addClass('activepopupthumb');

    });

    $('.owl-carousel.mobilepopupslider').on('changed.owl.carousel', function (event) { $(".thumbwrapper ul li").removeClass('activepopupthumb'); $(".thumbwrapper ul li").removeClass('activethumb1'); var jjj = $(".mobilepopupslider .owl-item.active").index(); $(".thumbwrapper ul li").eq(jjj).addClass('activethumb1'); });


    $(document).on("click", ".closeproductzoom,.darkbg-cover", function () { $(".productzoompopup").hide(); $(".darkbg-cover").hide() })
    $(document).on("click", ".thumbwrapper li", function () { $(".thumbwrapper li").removeClass("activethumb"); $(".thumbwrapper ul li").removeClass('activethumb1'); $(".thumbwrapper li").removeClass("activepopupthumb"); var ldf = $(this).index(); $('.mobilepopupslider').trigger('to.owl.carousel', [ldf, 0, true]); $(this).addClass('activethumb') });
    setTimeout(function () {
        if ($('.productslider li').length > 1) {
            $('.productslider').owlCarousel({
                loop: false,
                autoplay: false,
                margin: 10,
                nav: false,
                dots: true,
                responsive: {
                    0: {
                        items: 1
                    }
                }
            });
        }
        else {
            $('.productslider').removeClass('owl-carousel');
        }


        if ($('.mobilepopupslider li').length > 1) {
            $('.mobilepopupslider').owlCarousel({
                loop: false,
                autoplay: false,
                margin: 10,
                nav: false,
                dots: true,
                responsive: {
                    0: {
                        items: 1
                    }
                }
            });
        }
        else {
            $('.mobilepopupslider').removeClass('owl-carousel');
        }
    }, 500);

    $(".mobilepopupslider img").each(function () {
        var ldf = $(this).attr("src");
        console.log(ldf);
        $(".thumbwrapper ul").append('<li><img src="' + ldf + '" alt=""></li>');
    });

var $oldPrice = $('.old-price');
    
    // Check if the trimmed text is empty
    if ($.trim($oldPrice.text()) === "") {
        $('.discount').hide();
    }

    if (window.innerWidth > 1000) {
        jQuery('.share-icon').appendTo('#detailcol2 h1');
    }
</script>
<script>
    $(function () {

        const MIN_SCALE = 1;
        const MAX_SCALE = 5;
        const DOUBLE_TAP_SCALE = 2.5;

        let zScale = 1;
        let zTransX = 0;
        let zTransY = 0;
        var imgzoomsrc = $("#ctl00_phBody_ProductDetail_imgProduct").attr('src');
        $('#zoomImg').attr('src', imgzoomsrc);
        const $overlay = $('#zoomOverlay');
        const $zoomImg = $('#zoomImg');
        const $inner = $('#zoomImageInner');
        const $resetBtn = $('#zoomResetBtn');

        /* ── Helpers ── */
        function applyTransform(snap) {
            $zoomImg[0].style.transition = snap
                ? 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)'
                : 'transform 0.05s linear';
            $zoomImg[0].style.transform = `translate(${zTransX}px,${zTransY}px) scale(${zScale})`;
            $resetBtn.toggleClass('visible', zScale > 1.05);
        }

        function clampPan() {
            const W = $inner[0].clientWidth;
            const H = $inner[0].clientHeight;
            const maxX = Math.max(0, (W * zScale - W) / 2);
            const maxY = Math.max(0, (H * zScale - H) / 2);
            zTransX = Math.max(-maxX, Math.min(maxX, zTransX));
            zTransY = Math.max(-maxY, Math.min(maxY, zTransY));
        }

        function resetZoom() {
            zScale = 1; zTransX = 0; zTransY = 0;
            applyTransform(true);
        }
        function isMobile() {
            return window.matchMedia('(max-width: 768px)').matches;
        }
        /* ── Open / Close ── */
        function openZoom() {
            if (!isMobile()) return; // ← desktop: do nothing, no overlay
            resetZoom();
            $overlay.addClass('open');
            document.body.style.overflow = 'hidden';
        }

        function closeZoom() {
            $overlay.removeClass('open');
            document.body.style.overflow = '';
            resetZoom();
        }

        $('#productImage').on('click', openZoom);
        $('#zoomBack').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            closeZoom();
        });
        $resetBtn.on('click', resetZoom);
        $(document).on('keydown', e => { if (e.key === 'Escape') closeZoom(); });


        // Hide hint after 3s
        setTimeout(() => $('#zoomHint').addClass('hidden'), 3000);

        /* ── Double-tap ── */
        let lastTap = 0;

        $inner.on('click', function (e) {
            const now = Date.now();
            if (now - lastTap < 320) {
                const rect = $inner[0].getBoundingClientRect();
                const cx = e.clientX - rect.left - rect.width / 2;
                const cy = e.clientY - rect.top - rect.height / 2;

                $('<div class="tap-ripple">').css({ left: e.clientX - rect.left, top: e.clientY - rect.top })
                    .appendTo($inner).delay(450).queue(function () { $(this).remove(); $(this).dequeue(); });

                if (zScale > 1.2) {
                    resetZoom();
                } else {
                    zScale = DOUBLE_TAP_SCALE;
                    zTransX = -cx * (DOUBLE_TAP_SCALE - 1) / DOUBLE_TAP_SCALE;
                    zTransY = -cy * (DOUBLE_TAP_SCALE - 1) / DOUBLE_TAP_SCALE;
                    clampPan();
                    applyTransform(true);
                }
                lastTap = 0;
            } else {
                lastTap = now;
            }
        });

        /* ── Pinch & Pan ── */
        let touches = [];
        let panStartX = 0, panStartY = 0;
        let panStartTX = 0, panStartTY = 0;
        let pinchStartDist = 0, pinchStartScale = 1;
        let pinchMidX = 0, pinchMidY = 0;

        function getDist(t1, t2) {
            return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        }

        $inner[0].addEventListener('touchstart', function (e) {
            touches = Array.from(e.touches);
            if (touches.length === 1) {
                panStartX = touches[0].clientX; panStartY = touches[0].clientY;
                panStartTX = zTransX; panStartTY = zTransY;
            }
            if (touches.length === 2) {
                pinchStartDist = getDist(touches[0], touches[1]);
                pinchStartScale = zScale;
                pinchMidX = (touches[0].clientX + touches[1].clientX) / 2;
                pinchMidY = (touches[0].clientY + touches[1].clientY) / 2;
            }
        }, { passive: true });

        $inner[0].addEventListener('touchmove', function (e) {
            e.preventDefault();
            touches = Array.from(e.touches);

            if (touches.length === 1 && zScale > 1.05) {
                zTransX = panStartTX + (touches[0].clientX - panStartX);
                zTransY = panStartTY + (touches[0].clientY - panStartY);
                clampPan();
                applyTransform(false);
            }

            if (touches.length === 2) {
                const dist = getDist(touches[0], touches[1]);
                zScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartScale * (dist / pinchStartDist)));
                const mx = (touches[0].clientX + touches[1].clientX) / 2;
                const my = (touches[0].clientY + touches[1].clientY) / 2;
                zTransX += mx - pinchMidX;
                zTransY += my - pinchMidY;
                pinchMidX = mx; pinchMidY = my;
                clampPan();
                applyTransform(false);
            }
        }, { passive: false });

        $inner[0].addEventListener('touchend', function () {
            if (zScale < MIN_SCALE + 0.05) { resetZoom(); return; }
            clampPan();
            applyTransform(true);
        }, { passive: true });

        /* ── Mouse wheel (desktop) ── */
        $inner[0].addEventListener('wheel', function (e) {
            e.preventDefault();
            zScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, zScale * (e.deltaY > 0 ? 0.9 : 1.1)));
            clampPan();
            applyTransform(false);
        }, { passive: false });

    });
</script>
  <script src="/js/excerpts-1.1.0.js" type="text/javascript"></script>

    <script>
        excerpts.init({
            label: {
                selector: ".jb-peek-img", // data-jb-label
                text: "Preview This Book", // data-jb-label-text
                placement: {
                    x: "center",
                    y: "top-outside"
                }
            },
            modal: {
                selector: ".jb-modal-link", // default: a[data-jb-modal]
                positioning: "center" // default: "center"; can also be "left" or "right"
            }
        });
    </script>


                </div>
