<div class="panel panel-highlight shadow-subtle-light">
          <div class="panel-body">
            <form class="form-horizontal adv-search" action="/servlet/SearchResults?cm_sp=SearchF-_-Advs-_-Result" method="post" role="search">
                  <div class="row">
    <div class="col-sm-10 col-xs-12 col-sm-offset-1 mt-lg label-align">
          </div>
  </div>

      <input type="hidden" id="prc" name="prc" value="GBP">

          <div class="form-group">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label" for="author">
        <strong>Author</strong>
      </label>
      <div class="col-md-8 col-sm-8 col-xs-12">

        <div class="abeui-autosuggest" data-id="author" data-name="an" data-value="" data-replace-id="author" data-hide-clear-button="true" data-prevent-default="true"><div class="abe-auto-suggest-container"><div aria-haspopup="listbox" aria-owns="react-autowhatever-author" aria-expanded="false" class="react-autosuggest__container"><input type="search" autocomplete="off" aria-autocomplete="list" class="react-autosuggest__input" aria-expanded="false" id="author" data-test-id="author" name="an" role="combobox" spellcheck="false" tabindex="NaN" value=""><div id="react-autowhatever-author" class="react-autosuggest__suggestions-container"></div></div></div></div>
      </div>
    </div>

    <div class="form-group">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label" for="title">
        <strong>Title</strong>
      </label>
      <div class="col-md-8 col-sm-8 col-xs-12">

        <div class="abeui-autosuggest" data-id="title" data-name="tn" data-value="" data-replace-id="title" data-hide-clear-button="true" data-prevent-default="true"><div class="abe-auto-suggest-container"><div aria-haspopup="listbox" aria-owns="react-autowhatever-title" aria-expanded="false" class="react-autosuggest__container"><input type="search" autocomplete="off" aria-autocomplete="list" class="react-autosuggest__input" aria-expanded="false" id="title" data-test-id="title" name="tn" role="combobox" spellcheck="false" tabindex="NaN" value=""><div id="react-autowhatever-title" class="react-autosuggest__suggestions-container"></div></div></div></div>
      </div>
    </div>

    <div class="form-group">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label" for="isbn">
        <strong>ISBN</strong>
      </label>
      <div class="col-md-8 col-sm-8 col-xs-12">
        <input type="text" class="form-control" id="isbn" data-test-id="isbn" name="isbn" size="40" value="" maxlength="17">
      </div>
    </div>

    <div class="form-group">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label" for="keyword">
        <strong>Keywords</strong>
      </label>
      <div class="col-md-8 col-sm-8 col-xs-12">

        <div class="abeui-autosuggest" data-id="keyword" data-name="kn" data-value="" data-replace-id="keyword" data-hide-clear-button="true" data-prevent-default="true"><div class="abe-auto-suggest-container"><div aria-haspopup="listbox" aria-owns="react-autowhatever-keyword" aria-expanded="false" class="react-autosuggest__container"><input type="search" autocomplete="off" aria-autocomplete="list" class="react-autosuggest__input" aria-expanded="false" id="keyword" data-test-id="keyword" name="kn" role="combobox" spellcheck="false" tabindex="NaN" value=""><div id="react-autowhatever-keyword" class="react-autosuggest__suggestions-container"></div></div></div></div>
      </div>
    </div>

    <div class="form-group">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label" for="publisher">
        <strong>Publisher</strong>
      </label>
      <div class="col-md-8 col-sm-8 col-xs-12">

        <div class="abeui-autosuggest" data-id="publisher" data-name="pn" data-value="" data-replace-id="publisher" data-hide-clear-button="true" data-prevent-default="true"><div class="abe-auto-suggest-container"><div aria-haspopup="listbox" aria-owns="react-autowhatever-publisher" aria-expanded="false" class="react-autosuggest__container"><input type="search" autocomplete="off" aria-autocomplete="list" class="react-autosuggest__input" aria-expanded="false" id="publisher" data-test-id="publisher" name="pn" role="combobox" spellcheck="false" tabindex="NaN" value=""><div id="react-autowhatever-publisher" class="react-autosuggest__suggestions-container"></div></div></div></div>
      </div>
    </div>

    <div class="form-group">
      <fieldset>
        <legend class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
          <strong>Published Date</strong>
        </legend>
        <div class="col-md-5 col-sm-5 col-xs-12">
          <input type="text" class="short form-control" id="yrl" data-test-id="pub-year-min" maxlength="4" name="yrl" value="" aria-label="Minimum Published Year">
          <span> min to </span>
          <input type="text" class="short form-control" id="yrh" data-test-id="pub-year-max" maxlength="4" name="yrh" value="" aria-label="Maximum Published Year">
          <span>max</span>
        </div>
      </fieldset>
    </div>

    <div class="form-group">
      <fieldset>
        <legend class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
          <strong>Price (£)</strong>
        </legend>
        <div class="col-md-5 col-sm-5 col-xs-12">
          <input type="text" class="short form-control text" id="prl" data-test-id="price-min" maxlength="6" name="prl" value="" aria-label="Minimum Price (£)">
          <span> min to </span>
          <input type="text" class="short form-control text" id="prh" data-test-id="price-max" maxlength="6" name="prh" value="" aria-label="Maximum Price
            (£)">
          <span>max</span>
        </div>
      </fieldset>
    </div>

          <div class="adv-separator"></div>
    <div class="form-group" data-test-id="product-types">
    <fieldset>
      <legend class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
        <strong>Product Type</strong>
      </legend>
      <input type="hidden" id="ptype-hidden" name="pt">
            <div class="col-md-3 col-sm-3 col-xs-6">
                                      <div class="checkbox-inline col-xs-12">
            <label class="checkbox-label" for="ptype-book">
              <input type="checkbox" value="book" id="ptype-book" class="ptype">
              Books
            </label>
          </div>
                                      <div class="checkbox-inline col-xs-12">
            <label class="checkbox-label" for="ptype-art">
              <input type="checkbox" value="art" id="ptype-art" class="ptype">
              Art, Prints &amp; Posters
            </label>
          </div>
                                      <div class="checkbox-inline col-xs-12">
            <label class="checkbox-label" for="ptype-comic">
              <input type="checkbox" value="comic" id="ptype-comic" class="ptype">
              Comics
            </label>
          </div>
                                      <div class="checkbox-inline col-xs-12">
            <label class="checkbox-label" for="ptype-mag">
              <input type="checkbox" value="mag" id="ptype-mag" class="ptype">
              Magazines &amp; Periodicals
            </label>
          </div>
              </div>
            <div class="col-md-4 col-sm-4 col-xs-6">
                                      <div class="checkbox-inline col-xs-12">
            <label class="checkbox-label" for="ptype-ms">
              <input type="checkbox" value="ms" id="ptype-ms" class="ptype">
              Manuscripts &amp; Paper Collectibles
            </label>
          </div>
                                      <div class="checkbox-inline col-xs-12">
            <label class="checkbox-label" for="ptype-map">
              <input type="checkbox" value="map" id="ptype-map" class="ptype">
              Maps
            </label>
          </div>
                                      <div class="checkbox-inline col-xs-12">
            <label class="checkbox-label" for="ptype-photo">
              <input type="checkbox" value="photo" id="ptype-photo" class="ptype">
              Photographs
            </label>
          </div>
                                      <div class="checkbox-inline col-xs-12">
            <label class="checkbox-label" for="ptype-music">
              <input type="checkbox" value="music" id="ptype-music" class="ptype">
              Sheet Music
            </label>
          </div>
              </div>
    </fieldset>

  </div>

      <div class="adv-separator"></div>

        <div class="form-group" data-test-id="conditions">
      <fieldset>
        <legend class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
          <strong>Condition</strong>
        </legend>
        <div class="col-sm-9 col-xs-12">
          <div class="radio-inline">
            <label for="condition-any">
              <input type="radio" checked="" value="" id="condition-any" data-test-id="book-condition-any" name="cond">
                Any
            </label>
          </div>
          <div class="radio-inline">
            <label for="condition-new">
              <input type="radio" value="new" id="condition-new" data-test-id="book-condition-new" name="cond">
                New
            </label>
          </div>
          <div class="radio-inline">
            <label for="condition-used">
              <input type="radio" value="an+fine+nf+vg+good+fair+poor+uns" id="condition-used" data-test-id="book-condition-used" name="cond">
                Used
            </label>
          </div>
        </div>
      </fieldset>
    </div>


      <div class="form-group" data-test-id="binding">
      <fieldset>
        <legend class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
          <strong>Binding</strong>
        </legend>
        <div class="col-sm-9 col-xs-12">
          <div class="radio-inline">
            <label for="binding-all">
              <input type="radio" checked="" value="0" id="binding-all" data-test-id="binding-all" name="bi">
                Any
            </label>
         </div>
          <div class="radio-inline">
            <label for="binding-hardcover">
              <input type="radio" value="h" id="binding-hardcover" data-test-id="binding-hardcover" name="bi">
                Hardcover
            </label>
          </div>
          <div class="radio-inline">
            <label for="binding-softcover">
              <input type="radio" value="s" id="binding-softcover" data-test-id="binding-softcover" name="bi">
                Softcover
            </label>
          </div>
        </div>
      </fieldset>
    </div>

      <div class="form-group" data-test-id="language">
      <fieldset>
        <legend class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
          <strong>Language</strong>
        </legend>
        <div class="language-filter col-sm-9 col-xs-12" id="language-filter"><div id="language-filter-autosuggest-container"><div aria-haspopup="listbox" aria-owns="react-autowhatever-language-filter-autosuggest" aria-expanded="false" class="react-autosuggest__container"><input type="search" autocomplete="off" aria-autocomplete="list" aria-controls="react-autowhatever-language-filter-autosuggest" class="language-filter-input" aria-label="Language" aria-expanded="false" id="language-filter-input" placeholder="Enter language" role="combobox" spellcheck="false" tabindex="0" value=""><div id="react-autowhatever-language-filter-autosuggest" class="react-autosuggest__suggestions-container"></div></div><div id="language-filter-selected-pills-container"></div><div id="language-filter-buttons-container"></div></div></div>
      </fieldset>
    </div>

        <div class="form-group" data-test-id="attributes">
      <fieldset>
        <legend class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
          <strong>Attributes</strong>
        </legend>
        <div class="col-md-9 col-sm-9 col-xs-12">
                      <div class="checkbox-inline">
              <label for="fe"><input type="checkbox" id="fe" name="fe" data-test-id="first-edition-checkbox">
                First Edition
              </label>
            </div>
                                <div class="checkbox-inline">
              <label for="sgnd"><input type="checkbox" id="sgnd" name="sgnd" data-test-id="signed-checkbox">
                Signed
              </label>
            </div>
                                <div class="checkbox-inline">
              <label for="dj"><input type="checkbox" id="dj" name="dj" data-test-id="dust-jacket-checkbox">
                Dust Jacket
              </label>
            </div>
                                <div class="checkbox-inline">
              <label for="xpod">
                <input type="checkbox" id="xpod" name="xpod" value="on" data-test-id="not-print-on-demand-checkbox">
                <input type="hidden" id="xpod-hidden" name="xpod" value="off" disabled="disabled">
                Not Print on Demand
              </label>
            </div>
                  </div>
      </fieldset>
    </div>

        <div class="adv-separator"></div>
    <div class="form-group label-align seller-section" data-test-id="seller-options">
      <fieldset>
                  <legend class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
            <strong>Seller</strong>
          </legend>
          <div class="col-md-3 col-sm-4 col-xs-12 gap-xs">
            <select class="form-control" id="region-select-dropdown" name="rgn" data-current-value="ww" aria-label="Bookseller Region">
                                <option value="ww" selected="selected">Worldwide</option>
                            <option value="eu">European Union</option>
                            <option value="na">North America</option>
                            <option value="sa">South America</option>
                            <option value="er">Europe</option>
                            <option value="oc">Oceania</option>
                            <option value="as">Asia</option>
                        </select>
          </div>
          <div class="col-md-4 col-sm-4 col-xs-12">
                                                      <div id="countries-ww">
                <select class="form-control" name="cty" data-test-id="bookseller-country" aria-label="Bookseller Country">
                                    <option value="all" selected="selected">All Countries</option>
                            <option value="dz">Algeria</option>
                            <option value="ar">Argentina</option>
                            <option value="am">Armenia</option>
                            <option value="au">Australia</option>
                            <option value="at">Austria</option>
                            <option value="bb">Barbados</option>
                            <option value="be">Belgium</option>
                            <option value="br">Brazil</option>
                            <option value="bg">Bulgaria</option>
                            <option value="ca">Canada</option>
                            <option value="cl">Chile</option>
                            <option value="cn">China</option>
                            <option value="cy">Cyprus</option>
                            <option value="cz">Czech Republic</option>
                            <option value="dk">Denmark</option>
                            <option value="ee">Estonia</option>
                            <option value="fi">Finland</option>
                            <option value="fr">France</option>
                            <option value="ge">Georgia</option>
                            <option value="de">Germany</option>
                            <option value="gr">Greece</option>
                            <option value="gp">Guadeloupe</option>
                            <option value="gu">Guam</option>
                            <option value="hk">Hong Kong</option>
                            <option value="hu">Hungary</option>
                            <option value="in">India</option>
                            <option value="ie">Ireland</option>
                            <option value="il">Israel</option>
                            <option value="it">Italy</option>
                            <option value="jp">Japan</option>
                            <option value="kr">Korea, Republic of</option>
                            <option value="lv">Latvia</option>
                            <option value="lt">Lithuania</option>
                            <option value="lu">Luxembourg</option>
                            <option value="mt">Malta</option>
                            <option value="mx">Mexico</option>
                            <option value="nl">Netherlands</option>
                            <option value="nz">New Zealand</option>
                            <option value="no">Norway</option>
                            <option value="pl">Poland</option>
                            <option value="pt">Portugal</option>
                            <option value="ro">Romania</option>
                            <option value="sg">Singapore</option>
                            <option value="si">Slovenia</option>
                            <option value="za">South Africa</option>
                            <option value="es">Spain</option>
                            <option value="se">Sweden</option>
                            <option value="ch">Switzerland</option>
                            <option value="tw">Taiwan</option>
                            <option value="th">Thailand</option>
                            <option value="tr">Turkey</option>
                            <option value="us">U.S.A.</option>
                            <option value="uk">United Kingdom</option>
                            <option value="uy">Uruguay</option>
                            </select>
              </div>
                                                      <div id="countries-eu" hidden="hidden">
                <select class="form-control" name="cty" data-test-id="bookseller-country" aria-label="Bookseller Country" disabled="disabled">
                                    <option value="all" selected="selected">All Countries</option>
                            <option value="at">Austria</option>
                            <option value="be">Belgium</option>
                            <option value="bg">Bulgaria</option>
                            <option value="cy">Cyprus</option>
                            <option value="cz">Czech Republic</option>
                            <option value="dk">Denmark</option>
                            <option value="ee">Estonia</option>
                            <option value="fi">Finland</option>
                            <option value="fr">France</option>
                            <option value="de">Germany</option>
                            <option value="gr">Greece</option>
                            <option value="hu">Hungary</option>
                            <option value="ie">Ireland</option>
                            <option value="it">Italy</option>
                            <option value="lv">Latvia</option>
                            <option value="lt">Lithuania</option>
                            <option value="lu">Luxembourg</option>
                            <option value="mt">Malta</option>
                            <option value="nl">Netherlands</option>
                            <option value="pl">Poland</option>
                            <option value="pt">Portugal</option>
                            <option value="ro">Romania</option>
                            <option value="si">Slovenia</option>
                            <option value="es">Spain</option>
                            <option value="se">Sweden</option>
                            </select>
              </div>
                                                      <div id="countries-na" hidden="hidden">
                <select class="form-control" name="cty" data-test-id="bookseller-country" aria-label="Bookseller Country" disabled="disabled">
                                    <option value="all" selected="selected">All Countries</option>
                            <option value="ca">Canada</option>
                            <option value="mx">Mexico</option>
                            <option value="us">U.S.A.</option>
                            </select>
              </div>
                                                      <div id="countries-sa" hidden="hidden">
                <select class="form-control" name="cty" data-test-id="bookseller-country" aria-label="Bookseller Country" disabled="disabled">
                                    <option value="all" selected="selected">All Countries</option>
                            <option value="ar">Argentina</option>
                            <option value="br">Brazil</option>
                            <option value="cl">Chile</option>
                            <option value="uy">Uruguay</option>
                            </select>
              </div>
                                                      <div id="countries-er" hidden="hidden">
                <select class="form-control" name="cty" data-test-id="bookseller-country" aria-label="Bookseller Country" disabled="disabled">
                                    <option value="all" selected="selected">All Countries</option>
                            <option value="at">Austria</option>
                            <option value="be">Belgium</option>
                            <option value="bg">Bulgaria</option>
                            <option value="cy">Cyprus</option>
                            <option value="cz">Czech Republic</option>
                            <option value="dk">Denmark</option>
                            <option value="ee">Estonia</option>
                            <option value="fi">Finland</option>
                            <option value="fr">France</option>
                            <option value="de">Germany</option>
                            <option value="gr">Greece</option>
                            <option value="hu">Hungary</option>
                            <option value="ie">Ireland</option>
                            <option value="it">Italy</option>
                            <option value="lv">Latvia</option>
                            <option value="lt">Lithuania</option>
                            <option value="lu">Luxembourg</option>
                            <option value="mt">Malta</option>
                            <option value="nl">Netherlands</option>
                            <option value="no">Norway</option>
                            <option value="pl">Poland</option>
                            <option value="pt">Portugal</option>
                            <option value="ro">Romania</option>
                            <option value="si">Slovenia</option>
                            <option value="es">Spain</option>
                            <option value="se">Sweden</option>
                            <option value="ch">Switzerland</option>
                            <option value="uk">United Kingdom</option>
                            </select>
              </div>
                                                      <div id="countries-oc" hidden="hidden">
                <select class="form-control" name="cty" data-test-id="bookseller-country" aria-label="Bookseller Country" disabled="disabled">
                                    <option value="all" selected="selected">All Countries</option>
                            <option value="au">Australia</option>
                            <option value="gu">Guam</option>
                            <option value="nz">New Zealand</option>
                            </select>
              </div>
                                                      <div id="countries-as" hidden="hidden">
                <select class="form-control" name="cty" data-test-id="bookseller-country" aria-label="Bookseller Country" disabled="disabled">
                                    <option value="all" selected="selected">All Countries</option>
                            <option value="am">Armenia</option>
                            <option value="cn">China</option>
                            <option value="ge">Georgia</option>
                            <option value="hk">Hong Kong</option>
                            <option value="in">India</option>
                            <option value="il">Israel</option>
                            <option value="jp">Japan</option>
                            <option value="kr">Korea, Republic of</option>
                            <option value="sg">Singapore</option>
                            <option value="tw">Taiwan</option>
                            <option value="th">Thailand</option>
                            <option value="tr">Turkey</option>
                            </select>
              </div>
                      </div>

                                              <div class="col-md-9 col-sm-9 col-xs-12 col-md-offset-3 col-sm-offset-3">
            <div class="toggle-include-exclude">
              <label class="enable-seller-selection-lbl" for="enable-seller-selection">
                <input type="checkbox" id="enable-seller-selection" onclick="updateSellerSelection()" autocomplete="off">
                Only include or exclude specific sellers
              </label><div class="popover-spacer"></div><a class="link-popover" data-tippy-placement="right" data-tippy-content="&lt;b&gt;Limit your search by seller&lt;/b&gt;&lt;br&gt;Choose to restrict your search by only including up to 40 sellers in your search or alternatively you can also choose to exclude up to 40 sellers from your search." data-tippy-allowhtml="true" data-tippy-size="small" data-tippy-hideonclick="false"><img height="16" width="16" class="info-icon" src="//assets.prod.abebookscdn.com/cdn/shared/images/common/icons/icon_help.svg" alt="?">
              </a>
            </div>
          </div>
          <div class="col-md-3 col-sm-4 col-xs-12 col-md-offset-3 col-sm-offset-3 gap-xs">
            <select class="form-control" id="saction" name="saction" aria-label="Only include or exclude specific sellers" autocomplete="off" disabled="disabled">
                                <option value="block">Exclude</option>
                            <option value="allow" selected="selected">Include</option>
                        </select>
          </div>
          <div class="col-md-4 col-sm-4 col-xs-12">
            <span class="input">

              <div class="abeui-sellerautosuggest" data-id="sselect" data-name="" data-value="" data-replace-id="sselect" data-placeholder="Enter seller name" data-clear-on-select="true"><div class="abe-auto-suggest-container"><div aria-haspopup="listbox" aria-owns="react-autowhatever-sselect" aria-expanded="false" class="react-autosuggest__container"><input type="search" autocomplete="off" aria-autocomplete="list" class="react-autosuggest__input" aria-label="Enter seller name" aria-expanded="false" id="sselect" data-test-id="sselect" name="" placeholder="Enter seller name" role="combobox" spellcheck="false" value=""><div id="react-autowhatever-sselect" class="react-autosuggest__suggestions-container"></div></div></div></div>
            </span>
          </div>


                    <div id="seller-select-block-wrapper">
            <div id="seller-select-block">
              <div id="seller-select-label" class="col-md-6 col-sm-5 col-xs-12 col-md-offset-6 col-sm-offset-7" hidden="">
                <label>You can choose up to 40 sellers</label>
              </div>
              <div id="seller-select-label-error" class="col-md-6 col-sm-5 col-xs-12 col-md-offset-6 col-sm-offset-7 seller-select-label-error" hidden="" data-include-message="You have reached the 40 seller limit and cannot include any more sellers" data-exclude-message="You have reached the 40 seller limit and cannot exclude any more sellers">
                <label>You have reached the 40 seller limit and cannot include any more sellers</label>
              </div>
              <div class="col-md-6 col-sm-5 col-xs-12 col-md-offset-6 col-sm-offset-7" id="seller-id-list" data-max-sellers="40" data-cdn-url="//assets.prod.abebookscdn.com/cdn/shared" data-remove="Remove">
                                                                                                                <input type="hidden" id="seller-id-list-input" name="slist" value="">
                              </div>
            </div>
          </div>
              </fieldset>
    </div>

      <div class="adv-separator"></div>

        <div class="form-group toggle-align">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
        <strong>Group Similar Results</strong>
      </label>
      <div class="col-md-9 col-sm-9 col-xs-12">
        <div class="rollup-switch">
                <button type="button" class="rollup-toggle toggle-on" role="switch" aria-checked="true" onclick="toggleSwitch(this)" aria-label="Group Similar Results Similar items will be grouped together to display more unique items on the page." data-on="ON" data-off="OFF" data-name="rollup">
    <input type="hidden" id="rollup-input" name="rollup" value="on">
    <span id="rollup-text">ON</span>

</button><div class="popover-spacer"></div><a class="link-popover" data-tippy-placement="right" data-tippy-content="&lt;b&gt;Group Similar Results&lt;/b&gt;&lt;br&gt;Similar items will be grouped together to display more unique items on the page." data-tippy-allowhtml="true" data-tippy-size="small" data-tippy-hideonclick="false" aria-hidden="true" tabindex="-1"><img height="16" width="16" class="info-icon" src="//assets.prod.abebookscdn.com/cdn/shared/images/common/icons/icon_help.svg" alt="?">
</a>
</div>
</div>
</div>

        <div class="form-group toggle-align">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
        <strong>Expand All Descriptions</strong>
      </label>
      <div class="col-md-9 col-sm-9 col-xs-12">
        <div class="rollup-switch">
                <button type="button" class="rollup-toggle toggle-off" role="switch" aria-checked="false" onclick="toggleSwitch(this)" aria-label="Expand All Descriptions On the search results all the item descriptions will be expanded by default." data-on="ON" data-off="OFF" data-name="xdesc">
    <input type="hidden" id="xdesc-input" name="xdesc" value="off">
    <span id="xdesc-text">OFF</span>

</button><div class="popover-spacer"></div><a class="link-popover" data-tippy-placement="right" data-tippy-content="&lt;b&gt;Expand All Descriptions&lt;/b&gt;&lt;br&gt;On the search results all the item descriptions will be expanded by default." data-tippy-allowhtml="true" data-tippy-size="small" data-tippy-hideonclick="false" aria-hidden="true" tabindex="-1"><img height="16" width="16" class="info-icon" src="//assets.prod.abebookscdn.com/cdn/shared/images/common/icons/icon_help.svg" alt="?">
</a>
</div>
</div>
</div>

        <div class="form-group toggle-align">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label">
        <strong>Boolean Search</strong>
      </label>
      <div class="col-md-9 col-sm-9 col-xs-12">
        <div class="rollup-switch" data-test-id="boolean-switch">
                <button type="button" class="rollup-toggle toggle-off" role="switch" aria-checked="false" onclick="toggleSwitch(this)" aria-label="Boolean search Boolean logic helps you to expand or restrict your search and has three commands to use: NOT, AND, then OR." data-on="ON" data-off="OFF" data-name="bx">
    <input type="hidden" id="bx-input" name="bx" value="off">
    <span id="bx-text">OFF</span>

</button><div class="popover-spacer"></div><a class="link-popover" data-tippy-placement="right" data-tippy-content="&lt;b&gt;Boolean search&lt;/b&gt;&lt;br&gt;Boolean logic helps you to expand or restrict your search and has three commands to use: NOT, AND, then OR." data-tippy-allowhtml="true" data-tippy-size="small" data-tippy-hideonclick="false" aria-hidden="true" tabindex="-1"><img height="16" width="16" class="info-icon" src="//assets.prod.abebookscdn.com/cdn/shared/images/common/icons/icon_help.svg" alt="?">
</a>
</div>
</div>
</div>

        <div class="form-group">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label" for="recentlyadded"><strong>Books Listed Within</strong></label>
      <div class="col-md-4 col-sm-5 col-xs-12">
        <select class="form-control" id="recentlyadded" data-test-id="recently-listed" name="recentlyadded">
                            <option value="all" selected="selected">All</option>
                            <option value="1day">Listed in past 24 hours</option>
                            <option value="2day">Listed in past 48 hours</option>
                            <option value="3day">Listed in the past 3 days</option>
                            <option value="5day">Listed in the past 5 days</option>
                            <option value="7day">Listed in the past 7 days</option>
                            <option value="10day">Listed in the past 10 days</option>
                            <option value="14day">Listed in the past 14 days</option>
                            <option value="21day">Listed in the past 21 days</option>
                            <option value="30day">Listed in the past 30 days</option>
                            <option value="60day">Listed in the past 60 days</option>
                            <option value="90day">Listed in the past 90 days</option>
                    </select>
      </div>
    </div>

        <div class="form-group">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label" for="sortby"><strong>Sort By</strong></label>
      <div class="col-md-4 col-sm-5 col-xs-12">
        <select class="form-control" id="sortby" data-test-id="sortby" name="sortby">
                            <option value="5">Author/Artist A-Z</option>
                            <option value="4">Author/Artist Z-A</option>
                            <option value="1">Highest Price</option>
                            <option value="2">Lowest Price</option>
                            <option value="17">Lowest Total Price</option>
                            <option value="0">Most Recently Listed</option>
                            <option value="20" selected="selected">Relevance</option>
                            <option value="15">Seller Rating</option>
                            <option value="7">Title A-Z</option>
                            <option value="6">Title Z-A</option>
                            <option value="3">UK Sellers first</option>
                            <option value="19">Year of Publication Ascending</option>
                            <option value="18">Year of Publication Descending</option>
                    </select>
      </div>
    </div>

        <div class="form-group">
      <label class="col-md-2 col-sm-2 col-xs-12 col-md-offset-1 col-sm-offset-1 control-label" for="ds"><strong>Results Per Page</strong></label>
      <div class="col-md-4 col-sm-5 col-xs-12">
        <select class="form-control" id="ds" data-test-id="results-per-page" name="ds">
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="30" selected="selected">30</option>
                            <option value="40">40</option>
                            <option value="50">50</option>
                    </select>
      </div>
    </div>

                  <div class="form-group mb-lg mt-lg">
                <div class="col-sm-3 col-xs-12 col-md-3 control-label"></div>
                <div class="col-sm-8">
                  <button id="search-button" class="btn btn-abebooks btn-xs-block" type="submit">Search</button>
                </div>
              </div>
            </form>
          </div>
        </div>
