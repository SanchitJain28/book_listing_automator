## Image reference

<div id="main-image-container" class="a-dynamic-image-container" style="height: 307.005px;">
                                           <div class="a-hidden" id="auiImmersiveViewDiv"></div>
          <script>
        var markFeatureRenderExecuted = false;
        function markFeatureRenderForImageBlock() {
            if (!markFeatureRenderExecuted) {
                markFeatureRenderExecuted = true;
                P.now().execute('dp-mark-imageblock',function(){
                    var options = {
                        hasComponents: true,
                        components: [{
                            name: 'mainimage'
                        }]
                    };
                    if (typeof window.markFeatureRender === 'function') {
                        window.markFeatureRender('imageblock',options);
                    }
                });
            }
        }
    </script>
     <script type="text/javascript">
    P.now('A').execute("MediaBlockSlotResponsiveness", function(A){
        var contentLoadedMarkerPerIndex = {};
        var slotLoadedMarkerPerIndex = {};
        var mediaBlockPrimaryView = document.getElementById("imageBlock");
        var primaryViewSlotSelectorPrefix = ".desktop-media-mainView .item.itemNo";

        function isContentLoadedMarkedForIndex(slotIndex) {
            let isSlotIndexMarked = true;
            if (!contentLoadedMarkerPerIndex[slotIndex]) {
                isSlotIndexMarked = false;
                contentLoadedMarkerPerIndex[slotIndex] = true;
            }
            return isSlotIndexMarked;
        }

        function isSlotLoadedMarkedForIndex(slotIndex) {
            let isSlotIndexMarked = true;
            if (!slotLoadedMarkerPerIndex[slotIndex]) {
                isSlotIndexMarked = false;
                slotLoadedMarkerPerIndex[slotIndex] = true;
            }
            return isSlotIndexMarked;
        }

        function getSlotElementOfIndex(slotIndex) {
            return mediaBlockPrimaryView.querySelector(primaryViewSlotSelectorPrefix + slotIndex);
        }

        function isSlotIndexValid(slotIndex) {
            return typeof slotIndex === 'number' && Number.isInteger(slotIndex) && slotIndex >= 0;
        }

        window.logContentLoadedMarker = function(slotIndex){
            if(!isSlotIndexValid(slotIndex)) return;

            // Return if slotIndex is already marked
            if(isContentLoadedMarkedForIndex(slotIndex)) return;

            // Get the slot element of the primaryView using slotIndex
            let slotElement = getSlotElementOfIndex(slotIndex);

            // Log the contentLoaded marker
            if (window.csa) {
                let csaElement = window.csa("Content", {
                    element: slotElement
                });
                csaElement("mark", "contentLoaded");
            }
        }

        window.logSlotLoadedMarker = function (slotIndex) {
            if(!isSlotIndexValid(slotIndex)) return;

            // Return if slotIndex is already marked
            if(isSlotLoadedMarkedForIndex(slotIndex)) return;

            //Get the slot element of the primaryView using slotIndex
            let slotElement = getSlotElementOfIndex(slotIndex);

            // Log the slotLoaded marker
            if (window.csa) {
                let csaElement = window.csa("Content", {
                    element: slotElement
                });
                csaElement("mark", "slotLoaded");
            }
        }
    });

</script>
       <ul class="a-unordered-list a-nostyle a-horizontal list desktop-mainView-templates"> <li class="mainImageTemplate template"><span class="a-list-item"> <span class="a-declarative" data-action="main-image-click" data-main-image-click="{}" data-ux-click=""> <div class="imgTagWrapper">
                    <span class="placeHolder"></span> </div>
            </span> </span></li>    <li class="image item swatchHoverExp a-hidden maintain-height"><span class="a-list-item"> <span class="a-declarative" data-action="main-image-click" data-main-image-click="{}"> <div class="imgTagWrapper" style="height: 307.005px;">
            <span class="placeHolder"></span> </div>
    </span> </span></li>               <li data-csa-c-asin="1166359492" data-csa-c-component="imageBlock" data-csa-c-content-id="unavailable_media_content" data-csa-c-slot-id="unavailable_media_content_slot" data-csa-c-type="slot" class="mediaUnavailableExp variationUnavailable aok-hidden" data-csa-c-id="n1tvum-6t141v-nhtj9v-dptekq"><span class="a-list-item"> <div class="unavailableExp">
        <div class="inner">
             <div class="a-box a-alert a-alert-error" role="alert"><div class="a-box-inner a-alert-container"><h4 class="a-alert-heading">Image Unavailable</h4><i class="a-icon a-icon-alert" aria-hidden="true"></i><div class="a-alert-content"> <span class="a-text-bold"> Image not available for<br>Colour: <span class="unavailableVariation"></span>
                </span> </div></div></div> </div>
    </div>
</span></li>  </ul>        <ul class="a-unordered-list a-nostyle a-horizontal list maintain-height desktop-media-mainView">                                                                                                                     <li data-csa-c-action="mediaBlock-primaryView-mainView-click-to-open-iv" data-csa-c-component="primaryView" data-csa-c-content-id="71qAEsLK1uL" data-csa-c-media-block-entity="primaryView" data-csa-c-media-type="IMAGE" data-csa-c-posx="0" data-csa-c-slot-id="mediaBlock-primaryView-mainView-0" data-csa-c-type="widget" class="image item itemNo0 selected maintain-height cursorPointer variant-MAIN" style="cursor: pointer;" data-csa-c-id="pl58f2-8cnydq-49wj9b-ei9vve"><span class="a-list-item"> <span class="a-declarative" data-action="main-image-click" data-main-image-click="{}" data-ux-click=""> <div role="button" tabindex="0" id="imgTagWrapperId" class="imgTagWrapper" style="height: 307.005px;"><img alt="Merkwurdigkeiten Bey Der Romischen Konigswahl Und Kaiserkronung (1791) (German Edition)" src="https://m.media-amazon.com/images/I/71qAEsLK1uL._SY522_.jpg" data-mb-pv-slot-index="0" data-old-hires="https://m.media-amazon.com/images/I/71qAEsLK1uL._SL1360_.jpg" onload="this.onload='';markFeatureRenderForImageBlock();setCSMReq('af');if(typeof addlongPoleTag === 'function'){ addlongPoleTag('af','desktop-image-atf-marker');};setCSMReq('cf');logContentLoadedMarker(0);" data-a-image-name="landingImage" class="a-dynamic-image a-stretch-vertical media-block-image-tag" id="landingImage" data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/71qAEsLK1uL._SY342_.jpg&quot;:[342,215],&quot;https://m.media-amazon.com/images/I/71qAEsLK1uL._SY385_.jpg&quot;:[385,242],&quot;https://m.media-amazon.com/images/I/71qAEsLK1uL._SY425_.jpg&quot;:[425,267],&quot;https://m.media-amazon.com/images/I/71qAEsLK1uL._SY466_.jpg&quot;:[466,293],&quot;https://m.media-amazon.com/images/I/71qAEsLK1uL._SY522_.jpg&quot;:[522,328]}" style="max-width: 192.997px; max-height: 307px;" fetchpriority="high"></div> </span> </span></li>                                                                                                       <li data-csa-c-action="mediaBlock-primaryView-mainView-click-to-open-iv" data-csa-c-component="primaryView" data-csa-c-content-id="61iAo4iFU0L" data-csa-c-media-block-entity="primaryView" data-csa-c-media-type="IMAGE" data-csa-c-posx="1" data-csa-c-slot-id="mediaBlock-primaryView-mainView-1" data-csa-c-type="widget" class="image item itemNo1 maintain-height cursorPointer variant-BACK" data-csa-c-id="yp65eq-ygbusj-8cnw0m-k1tdav"><span class="a-list-item"> <span class="a-declarative" data-action="main-image-click" data-main-image-click="{}" data-ux-click=""> <div class="imgTagWrapper" style="height: 307.005px;"><div data-a-image-name="mbAltImage" data-mb-pv-slot-index="1" data-old-hires="https://m.media-amazon.com/images/I/61iAo4iFU0L._SL1360_.jpg" class="a-image-wrapper a-manually-loaded a-dynamic-image a-stretch-vertical media-block-image-tag" data-a-image-source="" data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/61iAo4iFU0L._SY342_.jpg&quot;:[342,215],&quot;https://m.media-amazon.com/images/I/61iAo4iFU0L._SY385_.jpg&quot;:[385,242],&quot;https://m.media-amazon.com/images/I/61iAo4iFU0L._SY425_.jpg&quot;:[425,267],&quot;https://m.media-amazon.com/images/I/61iAo4iFU0L._SY466_.jpg&quot;:[466,293],&quot;https://m.media-amazon.com/images/I/61iAo4iFU0L._SY522_.jpg&quot;:[522,328]}" style=""></div></div> </span> </span></li>        </ul>       <script type="text/javascript">
    var mainImgContainer = document.getElementById("main-image-container");
    var landingImage = document.getElementById("landingImage");
    var imgWrapperDiv = document.getElementById("imgTagWrapperId");
    
    var containerWidth = mainImgContainer.offsetWidth;
    var holderRatio = 0.6286549707602339;
    var containerHeight = containerWidth/holderRatio;
    containerHeight = Math.min(containerHeight, 700);

    var dynamicImageMaxHeight = 522 ;
    var dynamicImageMaxWidth = 328 ;

    var aspectRatio = dynamicImageMaxWidth/dynamicImageMaxHeight;

    var imageMaxHeight = containerHeight;
    var imageMaxWidth = containerWidth;

    if(!false) {
        imageMaxHeight = Math.min(imageMaxHeight, dynamicImageMaxHeight);
        imageMaxWidth = Math.min(imageMaxWidth, dynamicImageMaxWidth);
    }


    var useImageBlockLeftColCentering = false;
    var rightMargin = 0;

    if(typeof useImageBlockLeftColCentering !== "undefined" && useImageBlockLeftColCentering){
        mainImgContainer.style.marginRight = rightMargin + "px";
    }
    mainImgContainer.style.height = containerHeight + "px";

    var imageMaxWidthBasedOnHeight = imageMaxHeight * aspectRatio;
    var imageMaxHeightBasedOnWidth = imageMaxWidth / aspectRatio;
    imageMaxHeight = Math.min(imageMaxHeight, imageMaxHeightBasedOnWidth);
    imageMaxWidth = Math.min(imageMaxWidth, imageMaxWidthBasedOnHeight);

    if(imgWrapperDiv){
        imgWrapperDiv.style.height = containerHeight + "px";
    }

    if(landingImage){
        landingImage.style.maxHeight = imageMaxHeight + "px";
        landingImage.style.maxWidth = imageMaxWidth + "px";
    }

    // log first slot render marker
    if(window.logSlotLoadedMarker) {
        logSlotLoadedMarker(0);
    }

</script>
     </div>

## Product carousel

<div id="richProductInformation_feature_div" class="celwidget" data-feature-name="richProductInformation" data-csa-c-type="widget" data-csa-c-content-id="richProductInformation" data-csa-c-slot-id="richProductInformation_feature_div" data-csa-c-asin="1166359492" data-csa-c-is-in-initial-active-row="false" data-csa-c-id="pqecas-gm7a4w-yt8644-jbb2y4" data-cel-widget="richProductInformation_feature_div">
                              <div id="rich_product_information" class="a-section a-spacing-none celwidget" data-csa-c-id="jcp1ny-536dp2-uabzjs-wl11oc" data-cel-widget="rich_product_information">                 <hr aria-hidden="true" class="a-spacing-none a-divider-normal"> <div data-a-carousel-options="{&quot;set_size&quot;:7,&quot;name&quot;:&quot;rich-product-information-carousel&quot;,&quot;auto_adjust_height&quot;:false,&quot;circular&quot;:false,&quot;first_item_flush_left&quot;:true}" aria-label="Book details" data-a-class="desktop" role="region" aria-roledescription="carousel" class="a-begin a-carousel-container a-carousel-display-stretchyGoodness a-carousel-transition-slide a-spacing-none rpi-section rpi-section-iconic a-carousel-initialized"><input autocomplete="on" type="hidden" class="a-carousel-firstvisibleitem" value="3"> <div class="a-row a-carousel-controls a-carousel-row a-carousel-has-buttons"><div class="a-carousel-row-inner"><div class="a-carousel-col a-carousel-left" style="visibility: visible; height: 132px;"><a class="a-button a-button-image a-carousel-button a-carousel-goto-prevpage" role="button" href="#" id="a-autoid-2" aria-disabled="false" style="top: 52.7906px;"><span class="a-button-inner"><i class="a-icon a-icon-previous"><span class="a-icon-alt">Previous slide of product details</span></i></span></a></div><div class="a-carousel-col a-carousel-center"><div class="a-carousel-viewport" aria-roledescription="carousel" id="anonCarousel1" style=""><ol class="a-carousel" role="list" style="width: 1244px; transform: translateX(-378px) translateZ(0px);" aria-busy="false"><li aria-roledescription="slide" class="a-carousel-card rpi-carousel-attribute-card" style="margin-left: 0px; width: 110px; visibility: hidden;" aria-setsize="7" aria-posinset="1" aria-hidden="true">    <div id="rpi-attribute-book_details-fiona_pages" data-rpi-attribute-name="book_details-fiona_pages" data-rpi-attribute-ref-tag="dbs_dp_rpi_r_d_book_details_fiona_pages" class="a-section rpi-attribute-content celwidget" data-csa-c-id="jr9ysi-x671zt-v38m0g-ebm6p7" data-cel-widget="rpi-attribute-book_details-fiona_pages" tabindex="-1"> <div class="a-section a-spacing-small a-text-center rpi-attribute-label"> <span>Print length</span> </div> <div class="a-section a-spacing-small a-text-center"> <span class="rpi-icon book_details-fiona_pages"></span> </div> <div class="a-section a-spacing-none a-text-center rpi-attribute-value"> <span>244 pages</span> </div> </div>  </li><li aria-roledescription="slide" class="a-carousel-card rpi-carousel-attribute-card" aria-posinset="2" style="margin-left: 79px; width: 110px; visibility: hidden;" aria-setsize="7" aria-hidden="true">    <div id="rpi-attribute-language" data-rpi-attribute-name="language" data-rpi-attribute-ref-tag="dbs_dp_rpi_r_d_language" class="a-section rpi-attribute-content celwidget" data-csa-c-id="gco8he-fwtvu7-x83uk9-2o5ayo" data-cel-widget="rpi-attribute-language"> <div class="a-section a-spacing-small a-text-center rpi-attribute-label"> <span>Language</span> </div> <div class="a-section a-spacing-small a-text-center"> <span class="rpi-icon language"></span> </div> <div class="a-section a-spacing-none a-text-center rpi-attribute-value"> <span>German</span> </div> </div>  </li><li aria-roledescription="slide" class="a-carousel-card rpi-carousel-attribute-card" aria-posinset="3" style="margin-left: 79px; width: 110px;" aria-setsize="7" aria-hidden="false">    <div id="rpi-attribute-book_details-publisher" data-rpi-attribute-name="book_details-publisher" data-rpi-attribute-ref-tag="dbs_dp_rpi_r_d_book_details_publisher" class="a-section rpi-attribute-content celwidget" data-csa-c-id="jfbbsu-9m6fnb-nuhsp3-7vw4hk" data-cel-widget="rpi-attribute-book_details-publisher" tabindex="-1"> <div class="a-section a-spacing-small a-text-center rpi-attribute-label"> <span>Publisher</span> </div> <div class="a-section a-spacing-small a-text-center"> <span class="rpi-icon book_details-publisher"></span> </div> <div class="a-section a-spacing-none a-text-center rpi-attribute-value"> <span>Kessinger Publishing, LLC</span> </div> </div>  </li><li aria-roledescription="slide" class="a-carousel-card rpi-carousel-attribute-card" aria-posinset="4" style="margin-left: 79px; width: 110px;" aria-setsize="7" aria-hidden="false">    <div id="rpi-attribute-book_details-publication_date" data-rpi-attribute-name="book_details-publication_date" data-rpi-attribute-ref-tag="dbs_dp_rpi_r_d_book_details_publication_date" class="a-section rpi-attribute-content celwidget" data-csa-c-id="2lefhk-1ljfas-vukiou-8ps3dq" data-cel-widget="rpi-attribute-book_details-publication_date"> <div class="a-section a-spacing-small a-text-center rpi-attribute-label"> <span>Publication date</span> </div> <div class="a-section a-spacing-small a-text-center"> <span class="rpi-icon book_details-publication_date"></span> </div> <div class="a-section a-spacing-none a-text-center rpi-attribute-value"> <span>10 September 2010</span> </div> </div>  </li><li aria-roledescription="slide" class="a-carousel-card rpi-carousel-attribute-card" aria-posinset="5" style="margin-left: 79px; width: 110px; visibility: hidden;" aria-setsize="7" aria-hidden="true">    <div id="rpi-attribute-book_details-dimensions" data-rpi-attribute-name="book_details-dimensions" data-rpi-attribute-ref-tag="dbs_dp_rpi_r_d_book_details_dimensions" class="a-section rpi-attribute-content celwidget" data-csa-c-id="rzro4d-ewmndi-qb746o-yic9yc" data-cel-widget="rpi-attribute-book_details-dimensions" tabindex="-1"> <div class="a-section a-spacing-small a-text-center rpi-attribute-label"> <span>Dimensions</span> </div> <div class="a-section a-spacing-small a-text-center"> <span class="rpi-icon book_details-dimensions"></span> </div> <div class="a-section a-spacing-none a-text-center rpi-attribute-value"> <span>15.24 x 1.75 x 22.86 cm</span> </div> </div>  </li><li aria-roledescription="slide" class="a-carousel-card rpi-carousel-attribute-card" aria-posinset="6" style="margin-left: 79px; width: 110px; visibility: hidden;" aria-setsize="7" aria-hidden="true">    <div id="rpi-attribute-book_details-isbn10" data-rpi-attribute-name="book_details-isbn10" data-rpi-attribute-ref-tag="dbs_dp_rpi_r_d_book_details_isbn10" class="a-section rpi-attribute-content celwidget" data-csa-c-id="cb6zea-z2hoi-6nqvgf-u63b9l" data-cel-widget="rpi-attribute-book_details-isbn10"> <div class="a-section a-spacing-small a-text-center rpi-attribute-label"> <span>ISBN-10</span> </div> <div class="a-section a-spacing-small a-text-center"> <span class="rpi-icon book_details-isbn10"></span> </div> <div class="a-section a-spacing-none a-text-center rpi-attribute-value"> <span>1166359492</span> </div> </div>  </li><li aria-roledescription="slide" class="a-carousel-card rpi-carousel-attribute-card" aria-posinset="7" style="margin-left: 79px; width: 110px; visibility: hidden;" aria-setsize="7" aria-hidden="true">    <div id="rpi-attribute-book_details-isbn13" data-rpi-attribute-name="book_details-isbn13" data-rpi-attribute-ref-tag="dbs_dp_rpi_r_d_book_details_isbn13" class="a-section rpi-attribute-content celwidget" data-csa-c-id="7ioaj9-c4ejgt-fz8df-e5zlyv" data-cel-widget="rpi-attribute-book_details-isbn13"> <div class="a-section a-spacing-small a-text-center rpi-attribute-label"> <span>ISBN-13</span> </div> <div class="a-section a-spacing-small a-text-center"> <span class="rpi-icon book_details-isbn13"></span> </div> <div class="a-section a-spacing-none a-text-center rpi-attribute-value"> <span>978-1166359492</span> </div> </div>  </li></ol></div></div><div class="a-carousel-col a-carousel-right" style="visibility: visible; height: 132px;"><a class="a-button a-button-image a-carousel-button a-carousel-goto-nextpage" role="button" href="#" id="a-autoid-3" aria-disabled="false" style="top: 52.7906px;"><span class="a-button-inner"><i class="a-icon a-icon-next"><span class="a-icon-alt">Next slide of product details</span></i></span></a></div></div></div>  <span class="a-end aok-hidden"></span></div>      <div id="rich_product_information-learn_more_section" class="a-section a-spacing-small"> <a id="rich_product_information-learn_more_link" class="a-link-normal celwidget" href="#detailBullets_feature_div" data-csa-c-id="ikyqmd-7j1fcg-xwhs9n-b0jwcp" data-cel-widget="rich_product_information-learn_more_link"> See all details </a> </div>        </div>                                </div>

## Product details

<div id="detailBullets_feature_div" class="celwidget" data-feature-name="detailBullets" data-csa-c-type="widget" data-csa-c-content-id="detailBullets" data-csa-c-slot-id="detailBullets_feature_div" data-csa-c-asin="" data-csa-c-is-in-initial-active-row="false" data-csa-c-id="q0rfso-rygoww-acg7x7-4yn9pf" data-cel-widget="detailBullets_feature_div">
                              <style type="text/css">
    .detail-bullets-wrapper ul.detail-bullet-list {
        margin: 0 0 1px 18px;
    }
    .detail-bullets-wrapper ul li {
        margin-bottom: 5.5px;
    }
    .detail-bullets-wrapper:last-child {
        margin-bottom: 4.5px;
    }
</style>

 <div id="detailBulletsWrapper_feature_div" data-feature-name="detailBullets" data-template-name="detailBullets" class="a-section feature detail-bullets-wrapper bucket" data-cel-widget="detailBulletsWrapper_feature_div">    <hr aria-hidden="true" class="a-divider-normal bucketDivider"> <h2>Product details</h2>
        <div id="detailBullets_feature_div">
                     <ul class="a-unordered-list a-nostyle a-vertical a-spacing-none detail-bullet-list">         <li><span class="a-list-item"> <span class="a-text-bold">Publisher
                                            ‏
                                            :
                                            ‎
                                        </span>                <span>Kessinger Publishing, LLC</span>       </span></li>            <li><span class="a-list-item"> <span class="a-text-bold">Publication date
                                            ‏
                                            :
                                            ‎
                                        </span>                <span>10 September 2010</span>       </span></li>            <li><span class="a-list-item"> <span class="a-text-bold">Language
                                            ‏
                                            :
                                            ‎
                                        </span>    <span>German</span>   </span></li>            <li><span class="a-list-item"> <span class="a-text-bold">Print length
                                            ‏
                                            :
                                            ‎
                                        </span>                <span>244 pages</span>       </span></li>            <li><span class="a-list-item"> <span class="a-text-bold">ISBN-10
                                            ‏
                                            :
                                            ‎
                                        </span>                <span>1166359492</span>       </span></li>            <li><span class="a-list-item"> <span class="a-text-bold">ISBN-13
                                            ‏
                                            :
                                            ‎
                                        </span>                <span>978-1166359492</span>       </span></li>            <li><span class="a-list-item"> <span class="a-text-bold">Item Weight
                                            ‏
                                            :
                                            ‎
                                        </span>    <span>530 g</span>   </span></li>            <li><span class="a-list-item"> <span class="a-text-bold">Dimensions
                                            ‏
                                            :
                                            ‎
                                        </span>                <span>15.24 x 1.75 x 22.86 cm</span>       </span></li>                            <li><span class="a-list-item"> <span class="a-text-bold"> UNSPSC-Code : </span> <span> 55101500 (Printed publications) <span class="a-declarative" data-action="a-modal" data-a-modal="{&quot;padding&quot;:&quot;base&quot;,&quot;header&quot;:&quot;Report an incorrect UNSPSC code&quot;,&quot;url&quot;:&quot;/b2b/taxonomy/report/unspsc/1166359492/?ref_=b2b_dp_db_unspsc&quot;}" id="unspsc-report-modal"> <a href="#">
                    Report an incorrect code </a>
            </span> </span> </span></li> <script>
        P.when('A').execute(function (A) {
          A.declarative('unspsc-submission', 'submit', function handleSubmission(event) {
            event.$event.preventDefault();
            let unspscCodeAndTitle = "55101500 (Printed publications)";
            let unspscCode = unspscCodeAndTitle.slice(0, 8);
            submitUnspscForm(A, unspscCode);
          });
        });
    </script>
               </ul>   </div>
         <div class="a-row">       </div> <div class="a-row">         </div>   </div>                               </div>
