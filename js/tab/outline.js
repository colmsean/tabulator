/* -*- coding: utf-8-dos -*-
@@No DOS CRLF please

     Outline Mode
*/

tabulator.OutlineObject = function(doc) {
//      Needed? If so why?
//        var tabulator = Components.classes["@dig.csail.mit.edu/tabulator;1"]
//            .getService(Components.interfaces.nsISupports).wrappedJSObject;
    if (tabulator.isExtension) {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);
        var window = wm.getMostRecentWindow("navigator:browser");
        var gBrowser = window.getBrowser();
        var myDocument=doc;
    } else {
        // window = document.window;
        myDocument = doc;
    }

/*    //@@ jambo put this in timbl removed it
// it was part of the attempt to integrate rdfwidgets and jQuery with tabulator
// before jambo left for Google.  Keep the code for a bit in case we try again.

    var jq = function() {
        //var win = window.content.wrappedJSObject;
        var win = doc.wrappedJSObject.defaultView;
        this.window = win;
        this.document = win.document;
        this.navigator = win.navigator;
        this.location = win.location;
        this.jQuery = window.jQuery;
        // loader.loadSubScript("js/rdf/dist/rdflib.js");
        // loader.loadSubScript("js/widgets/jquery.rdf.widgets.js");
        return jQuery;
    }();
    jq.rdfwidgets.setStore( tabulator.kb );
*/
    tabulator.outline = this; // Allow panes to access outline.register()
    this.document=doc;
    var outline = this; //Kenny: do we need this?
    var thisOutline = this;
    var selection=[]
    this.selection=selection;
    this.ancestor = tabulator.Util.ancestor // make available as outline.ancestor in callbacks
    this.sparql = tabulator.rdf.sparqlUpdate;
    this.kb = tabulator.kb;
    var kb = tabulator.kb;
    var sf = tabulator.sf;
    var sourceWidget = tabulator.sourceWidget;
    myDocument.outline = this;
    
    
    //people like shortcuts for sure
    var tabont = tabulator.ns.tabont;
    var foaf = tabulator.ns.foaf;
    var rdf = tabulator.ns.rdf;
    var rdfs = RDFS = tabulator.ns.rdfs;
    var owl = OWL = tabulator.ns.owl;
    var dc = tabulator.ns.dc;
    var rss = tabulator.ns.rss;
    var contact = tabulator.ns.contact;
    var mo = tabulator.ns.mo;
    var link = tabulator.ns.link;
    
    //var selection = []  // Array of statements which have been selected
    this.focusTd; //the <td> that is being observed
    this.UserInput=new UserInput(this);
    this.clipboardAddress="tabulator:clipboard";
    this.UserInput.clipboardInit(this.clipboardAddress);
    var outlineElement=this.outlineElement;
     
    this.init = function(){
        var table=myDocument.getElementById('outline');
        table.outline=this;
    }    
    
    this.viewAndSaveQuery = function() {
        var qs = tabulator.qs;
        tabulator.log.info("outline.doucment is now " + outline.document.location);    
        var q = saveQuery();
        if(tabulator.isExtension) {
            tabulator.drawInBestView(q);
        } else {
            var i;
            for(i=0; i<qs.listeners.length; i++) {
                qs.listeners[i].getActiveView().view.drawQuery(q);
                qs.listeners[i].updateQueryControls(qs.listeners[i].getActiveView()); 
            }
        }
    }
    
    function saveQuery() {
        var qs = tabulator.qs;
        var q= new tabulator.rdf.Query()
        var i, n=selection.length, j, m, tr, sel, st;
        for (i=0; i<n; i++) {
            sel = selection[i]
            tr = sel.parentNode
            st = tr.AJAR_statement
            tabulator.log.debug("Statement "+st)
            if (sel.getAttribute('class').indexOf('pred') >= 0) {
            tabulator.log.info("   We have a predicate")
            tabulator.Util.makeQueryRow(q,tr)
            }
            if (sel.getAttribute('class').indexOf('obj') >=0) {
                    tabulator.log.info("   We have an object")
                    tabulator.Util.makeQueryRow(q,tr,true)
            }
        }   
        qs.addQuery(q);

        function resetOutliner(pat) {
            optionalSubqueriesIndex=[]
            var i, n = pat.statements.length, pattern, tr;
            for (i=0; i<n; i++) {
            pattern = pat.statements[i];
            tr = pattern.tr;
                    //tabulator.log.debug("tr: " + tr.AJAR_statement);
            if (typeof tr!='undefined')
            {
                    tr.AJAR_pattern = null; //TODO: is this == to whats in current version?
                    tr.AJAR_variable = null;
            }
            }
            for (x in pat.optional)
                    resetOutliner(pat.optional[x])
        }
        resetOutliner(q.pat);
        //NextVariable=0;
        return q;
    } // saveQuery

    /** benchmark a function **/
    benchmark.lastkbsize = 0;
    function benchmark(f) {
        var args = [];
        for (var i = arguments.length-1; i > 0; i--) args[i-1] = arguments[i];
        //tabulator.log.debug("BENCHMARK: args=" + args.join());
        var begin = new Date().getTime();
        var return_value = f.apply(f, args);
        var end = new Date().getTime();
        tabulator.log.info("BENCHMARK: kb delta: " + (kb.statements.length - benchmark.lastkbsize) 
                + ", time elapsed for " + f + " was " + (end-begin) + "ms");
        benchmark.lastkbsize = kb.statements.length;
        return return_value;
    } //benchmark
    
    ///////////////////////// Representing data
    //  Represent an object in summary form as a table cell
    function appendRemoveIcon(node, subject, removeNode) {
        var image = tabulator.Util.AJARImage(tabulator.Icon.src.icon_remove_node, 'remove',undefined, myDocument)
        // image.setAttribute('align', 'right')  Causes icon to be moved down
        image.node = removeNode
        image.setAttribute('about', subject.toNT())
        image.style.marginLeft="5px"
        image.style.marginRight="10px"
        //image.style.border="solid #777 1px"; 
        node.appendChild(image)
        return image
    }
    
    this.appendAccessIcons = function(kb, node, obj) {
        if (obj.termType != 'symbol') return;
        var uris = kb.uris(obj);
        uris.sort();
        var last = null;
        for(var i=0; i<uris.length; i++) {
            if (uris[i] == last) continue;
            last = uris[i];
            thisOutline.appendAccessIcon(node, last);
        }
    
    }


    this.appendAccessIcon = function(node, uri) {
        if (!uri) return '';
        var docuri = tabulator.rdf.Util.uri.docpart(uri);
        if (docuri.slice(0,5) != 'http:') return '';
        var state = sf.getState(docuri);
        var icon, alt;
        switch (state) {
            case 'unrequested': 
                icon = tabulator.Icon.src.icon_unrequested;
                alt = 'fetch';
            break;
            case 'requested':
                icon = tabulator.Icon.src.icon_requested;
                alt = 'fetching';
            break;
            case 'fetched':
                icon = tabulator.Icon.src.icon_fetched;
                alt = 'loaded';
            break;
            case 'failed':
                icon = tabulator.Icon.src.icon_failed;
                alt = 'failed';
            break;
            case 'unpermitted':
                icon = tabulator.Icon.src.icon_failed;
                alt = 'no perm';
            break;
            case 'unfetchable':
                icon = tabulator.Icon.src.icon_failed;
                alt = 'cannot fetch';
            break;
            default:
                tabulator.log.error("?? state = " + state);
            break;
        } //switch
        var img = tabulator.Util.AJARImage(icon, alt, 
                                           tabulator.Icon.tooltips[icon].replace(/[Tt]his resource/, docuri),myDocument)
        img.setAttribute('uri', uri);
        addButtonCallbacks(img, docuri) 
        node.appendChild(img)
        return img
    } //appendAccessIcon
    
    //Six different Creative Commons Licenses:
    //1. http://creativecommons.org/licenses/by-nc-nd/3.0/ 
    //2. http://creativecommons.org/licenses/by-nc-sa/3.0/
    //3. http://creativecommons.org/licenses/by-nc/3.0/
    //4. http://creativecommons.org/licenses/by-nd/3.0/
    //5. http://creativecommons.org/licenses/by-sa/3.0/
    //6. http://creativecommons.org/licenses/by/3.0/
    
    /** make the td for an object (grammatical object) 
     *  @param obj - an RDF term
     *  @param view - a VIEW function (rather than a bool asImage)
     **/
     
     tabulator.options = {};
     
     tabulator.options.references = [];
     
     this.openCheckBox = function ()
     
     {
     
        display = window.open(" ",'NewWin',
            'menubar=0,location=no,status=no,directories=no,toolbar=no,scrollbars=yes,height=200,width=200')
     
        display.tabulator = tabulator;
        tabulator.options.names = [ 'BY-NC-ND', 'BY-NC-SA', 'BY-NC', 'BY-ND', 'BY-SA', 'BY'];
                                  
        var message="<font face='arial' size='2'><form name ='checkboxes'>";
        var lics = tabulator.options.checkedLicenses;
        for (var kk =0; kk< lics.length; kk++)
            message += "<input type='checkbox' name = 'n"+kk+
                "' onClick = 'tabulator.options.submit()'"
                + (lics[kk] ? "CHECKED" : "") + " />CC: "+tabulator.options.names[kk]+"<br />";
                 
        message+="<br /> <a onclick='tabulator.options.selectAll()'>[Select All] </a>";
        message+="<a onclick='tabulator.options.deselectAll()'> [Deselect All]</a>";
        message+="</form></font>";
                 
        display.document.write(message);
                 
        display.document.close(); 
        
        var i;
        for(i=0; i<6; i++){
            tabulator.options.references[i] = display.document.checkboxes.elements[i];
        }     
    }
    
    
    tabulator.options.checkedLicenses = [];
   
    tabulator.options.selectAll = function()
    {
        var i;
        for(i=0; i<6; i++){
            display.document.checkboxes.elements[i].checked = true;
            tabulator.options.references[i].checked = true;
            tabulator.options.checkedLicenses[i] = true;
        }
        
    }
    
    tabulator.options.deselectAll = function()
    {
        var i;
        for(i=0; i<6; i++){
            display.document.checkboxes.elements[i].checked = false;
            tabulator.options.references[i].checked = false;
            tabulator.options.checkedLicenses[i] = false;
        }
    
    }
    
    
    tabulator.options.submit = function()
    {   
        alert('tabulator.options.submit: checked='+tabulator.options.references[0].checked);
        for(i=0; i<6; i++)
        {   tabulator.options.checkedLicenses[i] = !!
                    tabulator.options.references[i].checked;
        }
    }
        
            
    this.outline_objectTD = function outline_objectTD(obj, view, deleteNode, statement) {
        // tabulator.log.info("@outline_objectTD, myDocument is now " + this.document.location);
        var td = myDocument.createElement('td');
        var theClass = "obj";
                
        // check the IPR on the data.  Ok if there is any checked license which is one the document has.
	if (statement){
            var licenses = kb.each(statement.why, kb.sym('http://creativecommons.org/ns#license'));
            tabulator.log.info('licenses:'+ statement.why+': '+ licenses)
            var licenseURI = ['http://creativecommons.org/licenses/by-nc-nd/3.0/',
                        'http://creativecommons.org/licenses/by-nc-sa/3.0/',
                        'http://creativecommons.org/licenses/by-nc/3.0/',
                        'http://creativecommons.org/licenses/by-nd/3.0/',
                        'http://creativecommons.org/licenses/by-sa/3.0/',
                        'http://creativecommons.org/licenses/by/3.0/' ];
            for (i=0; i< licenses.length; i++) {
                for (j=0; j<tabulator.options.checkedLicenses.length; j++) {
                    if (tabulator.options.checkedLicenses[j] && (licenses[i].uri == licenseURI[j])) {                
                        theClass += ' licOkay';
                        break;
                    }
                }
            }
        }
              
        //set about and put 'expand' icon
        if ((obj.termType == 'symbol') || (obj.termType == 'bnode') ||
                (obj.termType == 'literal' && obj.value.slice && (
                    obj.value.slice(0,6) == 'ftp://' ||
                    obj.value.slice(0,8) == 'https://' ||
                    obj.value.slice(0,7) == 'http://'))) {
            td.setAttribute('about', obj.toNT());
            td.appendChild(tabulator.Util.AJARImage(
                tabulator.Icon.src.icon_expand, 'expand',undefined,myDocument));
        }
        td.setAttribute('class', theClass);      //this is how you find an object
        // tabulator.log.info('class on '+td)
        var check = td.getAttribute('class')
        // tabulator.log.info('td has class:' + check)
        // tabulator.log.info("selection has " +selection.map(function(item){return item.textContent;}).join(", "));             
         
        if (kb.whether(obj, tabulator.ns.rdf('type'), tabulator.ns.link('Request')))
            td.className='undetermined'; //@@? why-timbl
            
        if (!view) // view should be a function pointer
            view = VIEWAS_boring_default;
        td.appendChild( view(obj) );    
        if (deleteNode) {
            appendRemoveIcon(td, obj, deleteNode)
        }

        try{var DDtd = new YAHOO.util.DDExternalProxy(td);}
        catch(e){tabulator.log.error("YAHOO Drag and drop not supported:\n"+e);}
        
        //set DOM methods
        td.tabulatorSelect = function (){setSelected(this,true);};
        td.tabulatorDeselect = function(){setSelected(this,false);};            
        //td.appendChild( iconBox.construct(document.createTextNode('bla')) );

        //Create an inquiry icon if there is proof about this triple
	if(statement){
            var one_statement_formula = new tabulator.rdf.IndexedFormula();
            one_statement_formula.statements.push(statement); //st.asFormula()
            //The following works because Formula.hashString works fine for
            //one statement formula
            var reasons = kb.each(one_statement_formula,
       kb.sym("http://dig.csail.mit.edu/TAMI/2007/amord/tms#justification"));
            if(reasons.length){
                var inquiry_span = myDocument.createElement('span');
                if(reasons.length>1)
                     inquiry_span.innerHTML = ' &times; ' + reasons.length;
                inquiry_span.setAttribute('class', 'inquiry'); 
                inquiry_span.insertBefore(tabulator.Util.AJARImage(tabulator.Icon.src.icon_display_reasons, 'explain',undefined,myDocument), inquiry_span.firstChild);
	        td.appendChild(inquiry_span);
            }
        }
        return td;
    } //outline_objectTD
    
    this.outline_predicateTD = function outline_predicateTD(predicate,newTr,inverse,internal){
        
        var td_p = myDocument.createElement("TD")
                td_p.setAttribute('about', predicate.toNT())
        td_p.setAttribute('class', internal ? 'pred internal' : 'pred')
        
        switch (predicate.termType){
            case 'bnode': //TBD
                td_p.className='undetermined';
            case 'symbol': 
                var lab = tabulator.Util.predicateLabelForXML(predicate, inverse);
                break;
            case 'collection': // some choices of predicate
                lab = tabulator.Util.predicateLabelForXML(predicate.elements[0],inverse);
        }
        lab = lab.slice(0,1).toUpperCase() + lab.slice(1)
        //if (kb.statementsMatching(predicate,rdf('type'), tabulator.ns.link('Request')).length) td_p.className='undetermined';

        var labelTD = myDocument.createElement('TD')
        labelTD.setAttribute('notSelectable','true')
        labelTD.appendChild(myDocument.createTextNode(lab))
        td_p.appendChild(labelTD);
        labelTD.style.width='100%'
        td_p.appendChild(termWidget.construct(myDocument)); //termWidget is global???
        for (var w in tabulator.Icon.termWidgets) {
            if(!newTr||!newTr.AJAR_statement) break; //case for TBD as predicate
                    //alert(Icon.termWidgets[w]+"   "+Icon.termWidgets[w].filter)
            if (tabulator.Icon.termWidgets[w].filter
                && tabulator.Icon.termWidgets[w].filter(newTr.AJAR_statement,'pred',
                                inverse))
                termWidget.addIcon(td_p,tabulator.Icon.termWidgets[w])
        }

        try{var DDtd = new YAHOO.util.DDExternalProxy(td_p);}
        catch(e){tabulator.log.error("drag and drop not supported");}        
        //set DOM methods
        td_p.tabulatorSelect = function (){setSelected(this,true);};
        td_p.tabulatorDeselect = function(){setSelected(this,false);}; 
        return td_p;              
    } //outline_predicateTD
/*
    ///////////////// Represent an arbirary subject by its properties
    //These are public variables ---  @@@@ ugh
    expandedHeaderTR.tr = myDocument.createElement('tr');
    expandedHeaderTR.td = myDocument.createElement('td');
    expandedHeaderTR.td.setAttribute('colspan', '2');
    expandedHeaderTR.td.appendChild(tabulator.Util.AJARImage(tabulator.Icon.src.icon_collapse, 'collapse',undefined,myDocument));
    expandedHeaderTR.td.appendChild(myDocument.createElement('strong'));
    expandedHeaderTR.tr.appendChild(expandedHeaderTR.td);
*/
    function makeExpandedHeaderTR(myDocument) {
        return tr;
    };
    
    function expandedHeaderTR(subject, requiredPane) {
        var tr = myDocument.createElement('tr');
        var td = myDocument.createElement('td');
        td.setAttribute('colspan', '2');
        td.appendChild(tabulator.Util.AJARImage(tabulator.Icon.src.icon_collapse, 'collapse',undefined,myDocument));
        td.appendChild(myDocument.createElement('strong'));
        tr.appendChild(td);

        // var tr = makeExpandedHeaderTR(myDocument); //This sets the private tr as a clone of the public tr
        tr.firstChild.setAttribute('about', subject.toNT());
        tr.firstChild.childNodes[1].appendChild(myDocument.createTextNode(tabulator.Util.label(subject)));
        tr.firstPane = null;
        var paneNumber = 0;
        var relevantPanes = [];
        var labels = [];
        

        if (requiredPane) {
            tr.firstPane = requiredPane;
        };
        for (var i=0; i< tabulator.panes.list.length; i++) {
            var pane = tabulator.panes.list[i];
            var lab = pane.label(subject, myDocument);
            if (!lab) continue;

            relevantPanes.push(pane);
            if (pane == requiredPane) {
                paneNumber = relevantPanes.length-1; // point to this one
            }
            labels.push(lab);
            //steal the focus
            if (!tr.firstPane && pane.shouldGetFocus && pane.shouldGetFocus(subject)){
                tr.firstPane = pane;
                paneNumber = relevantPanes.length-1;
                tabulator.log.info('the '+i+'th pane steals the focus');
            }
        }
        if (!relevantPanes) relevantPanes.push(internalPane);
        tr.firstPane = tr.firstPane || relevantPanes[0];
        if (relevantPanes.length != 1) { // if only one, simplify interface
            for (var i=0; i<relevantPanes.length; i++) {
                var pane = relevantPanes[i];
                var ico = tabulator.Util.AJARImage(pane.icon, labels[i], labels[i],myDocument);
                // ico.setAttribute('align','right');   @@ Should be better, but ffox bug pushes them down
                var listen = function(ico, pane) {  // Freeze scope for event time
                    ico.addEventListener('click', function(event) { 
                        // Find the containing table for this subject 
                        for (var t = td; t.parentNode;  t = t.parentNode) {
                            if (t.nodeName == 'TABLE') break;
                        }
                        if  (t.nodeName != 'TABLE') throw "outline: internal error: "+t;
                        
                        
                        // If the view already exists, remove it
                        var state = 'paneShown';
                        var numberOfPanesRequiringQueryButton = 0;
                        for (var d = t.firstChild; d; d = d.nextSibling) {
                            if (d.pane && d.pane.requireQueryButton) numberOfPanesRequiringQueryButton++;
                        }
                        for (var d = t.firstChild; d; d = d.nextSibling) {
                            if (typeof d.pane != 'undefined') {
                                if (d.pane == pane) {                      
                                    removeAndRefresh(d)                           
                                    // If we just delete the node d, ffox doesn't refresh the display properly.
                                    state = 'paneHidden';
                                    if (d.pane.requireQueryButton && t.parentNode.className /*outer table*/
                                        && numberOfPanesRequiringQueryButton == 1 && myDocument.getElementById('queryButton'))
                                        myDocument.getElementById('queryButton').setAttribute('style','display:none;');
                                    break;
                                }
                            }
                        }
                        // If the view does not exist, create it
                        if (state == 'paneShown') {
                            var paneDiv;
                            try {
                                tabulator.log.info('outline: Rendering pane (2): '+pane.name)
                                paneDiv = pane.render(subject, myDocument);
                            }
                            catch(e) { // Easier debugging for pane developers
                                paneDiv = myDocument.createElement("div")
                                paneDiv.setAttribute('class', 'exceptionPane');
                                var pre = myDocument.createElement("pre")
                                paneDiv.appendChild(pre);
                                pre.appendChild(myDocument.createTextNode(tabulator.Util.stackString(e)));
                            }
                            if (pane.requireQueryButton && myDocument.getElementById('queryButton'))
                                myDocument.getElementById('queryButton').removeAttribute('style');
                            var second = t.firstChild.nextSibling;
                            if (second) t.insertBefore(paneDiv, second);
                            else t.appendChild(paneDiv);
                            paneDiv.pane = pane;
                        }
                        ico.setAttribute('class', state) // set the button state
                        // outline_expand(p, subject, internalPane, true); //  pane, already

                    
                    
                    // paneEventClick();
                    }, false);
                }; // listen
                
                listen(ico, pane);
                ico.setAttribute('class',  (i!=paneNumber) ? 'paneHidden':'paneShown')
                tr.firstChild.childNodes[1].appendChild(ico);
            }
        }
        
        //set DOM methods
        tr.firstChild.tabulatorSelect = function (){setSelected(this,true);};
        tr.firstChild.tabulatorDeselect = function(){setSelected(this,false);};   
        return tr;
    } //expandedHeaderTR



 



/////////////////////////////////////////////////////////////////////////////

    /*  PANES
    **
    **     Panes are regions of the outline view in which a particular subject is
    ** displayed in a particular way.  They are like views but views are for query results.
    ** subject panes are currently stacked vertically.
    */


    
    ///////////////////////  Specific panes are in panes/*.js 
    //
    // The defaultPaneis the first one registerd for which the label
    //  method 
    // Those registered first take priority as a default pane.
    // That is, those earlier in this file
    


	/**
	 * Pane registration
	 */
	
 	//the second argument indicates whether the query button is required
    
    
//////////////////////////////////////////////////////////////////////////////

    // Remove a node from the DOM so that Firefox refreshes the screen OK
    // Just deleting it cause whitespace to accumulate.
    function removeAndRefresh(d) {
        var table = d.parentNode
        var par = table.parentNode
        var placeholder = myDocument.createElement('table')
        par.replaceChild(placeholder, table)
        table.removeChild(d);
        par.replaceChild(table, placeholder) // Attempt to 
    }

    var propertyTable = this.propertyTable = function propertyTable(subject, table, pane) {
        tabulator.log.debug("Property table for: "+ subject)
        subject = kb.canon(subject)
        // if (!pane) pane = tabulator.panes.defaultPane;
        
        if (!table) { // Create a new property table
            var table = myDocument.createElement('table');
            var tr1 = expandedHeaderTR(subject, pane);
            table.appendChild(tr1);
            
            /*   This should be a beautiful system not a quick kludge - timbl 
            **   Put  link to inferenceWeb browsers for anything which is a proof
            **    @@@ This should just be an optional pane.
            */  
            /*
            var classes = kb.each(subject, rdf('type'))
            var i=0, n=classes.length;
            for (i=0; i<n; i++) {
                if (classes[i].uri == 'http://inferenceweb.stanford.edu/2004/07/iw.owl#NodeSet') {
                    var anchor = myDocument.createElement('a');
                    anchor.setAttribute('href', "http://silo.stanford.edu/iwbrowser/NodeSetBrowser?url=" + encodeURIComponent(subject.uri)); // @@ encode
                    anchor.setAttribute('title', "Browse in Infereence Web");
                    anchor.appendChild(tabulator.Util.AJARImage(
                                                 'http://iw.stanford.edu/2.0/images/iw-logo-icon.png', 'IW', 'Inference Web',myDocument));
                    tr1.appendChild(anchor)
                }
            }
            */
//            table.appendChild(defaultPane.render(subject));
            if (tr1.firstPane) {
                if (typeof tabulator == 'undefined') alert('tabulator undefined')
                var paneDiv;
                try {
                    tabulator.log.info('outline: Rendering pane (1): '+tr1.firstPane.name)
                    paneDiv = tr1.firstPane.render(subject, myDocument);
                    // paneDiv = tr1.firstPane.render(subject, myDocument, jq);
                }
                catch(e) { // Easier debugging for pane developers
                    paneDiv = myDocument.createElement("div")
                    paneDiv.setAttribute('class', 'exceptionPane');
                    var pre = myDocument.createElement("pre")
                    paneDiv.appendChild(pre);
                    pre.appendChild(myDocument.createTextNode(tabulator.Util.stackString(e)));
                }

                if (tr1.firstPane.requireQueryButton && myDocument.getElementById('queryButton'))
                    myDocument.getElementById('queryButton').removeAttribute('style');
                table.appendChild(paneDiv);
                paneDiv.pane = tr1.firstPane;
            }
            
            return table
            
        } else {  // New display of existing table, keeping expanded bits
        
            tabulator.log.info('Re-expand: '+table)
            try{table.replaceChild(expandedHeaderTR(subject),table.firstChild)}
            catch(e){}   // kludge... Todo: remove this (seeAlso UserInput::clearInputAndSave)
            var row, s
            var expandedNodes = {}
    
            for (row = table.firstChild; row; row = row.nextSibling) { // Note which p,o pairs are exppanded
                if (row.childNodes[1]
                    && row.childNodes[1].firstChild.nodeName == 'TABLE') {
                    s = row.AJAR_statement
                    if (!expandedNodes[s.predicate.toString()]) {
                        expandedNodes[s.predicate.toString()] = {}
                    }
                    expandedNodes[s.predicate.toString()][s.object.toString()] =
                        row.childNodes[1].childNodes[1]
                }
            }
    
            table = propertyTable(subject, undefined, pane)  // Re-build table
    
            for (row = table.firstChild; row; row = row.nextSibling) {
                s = row.AJAR_statement
                if (s) {
                    if (expandedNodes[s.predicate.toString()]) {
                        var node =
                            expandedNodes[s.predicate.toString()][s.object.toString()]
                        if (node) {
                            row.childNodes[1].replaceChild(node,
                                            row.childNodes[1].firstChild)
                        }
                    }
                }
            }
    
            // do some other stuff here
            return table
        }
    } /* propertyTable */

    function propertyTR(doc, st, inverse) {
            var tr = doc.createElement("TR");
            tr.AJAR_statement = st;
            tr.AJAR_inverse = inverse;
            // tr.AJAR_variable = null; // @@ ??  was just "tr.AJAR_variable"
            tr.setAttribute('predTR','true');
            var td_p = thisOutline.outline_predicateTD(st.predicate, tr, inverse);
            tr.appendChild(td_p) // @@ add "internal" to td_p's class for style? mno
            return tr;
    }
    this.propertyTR = propertyTR;
    
    ///////////// Property list 
    function appendPropertyTRs(parent, plist, inverse, predicateFilter) {
        //tabulator.log.info("@appendPropertyTRs, 'this' is %s, myDocument is %s, "+ // Gives "can't access dead object"
        //                   "thisOutline.document is %s", this, myDocument.location, thisOutline.document.location);
        //tabulator.log.info("@appendPropertyTRs, myDocument is now " + this.document.location);
        //tabulator.log.info("@appendPropertyTRs, myDocument is now " + thisOutline.document.location);            
        tabulator.log.debug("Property list length = " + plist.length)
        if (plist.length == 0) return "";
        var sel
        if (inverse) {
            sel = function(x) {return x.subject}
            plist = plist.sort(tabulator.Util.RDFComparePredicateSubject)
        } else {
            sel = function(x){return x.object}
            plist = plist.sort(tabulator.Util.RDFComparePredicateObject)
        }
        var j
        var max = plist.length
        for (j=0; j<max; j++) { //squishing together equivalent properties I think
            var s = plist[j]
        //      if (s.object == parentSubject) continue; // that we knew
        
            // Avoid predicates from other panes
            if (predicateFilter && !predicateFilter(s.predicate, inverse)) continue;
            var k;
            var dups = 0; // How many rows have the same predicate, -1?
            var langTagged = 0;  // how many objects have language tags?
            var myLang = 0; // Is there one I like?
            for (k=0; (k+j < max) && (plist[j+k].predicate.sameTerm(s.predicate)); k++) {
                if (k>0 && (sel(plist[j+k]).sameTerm(sel(plist[j+k-1])))) dups++;
                if (sel(plist[j+k]).lang) {
                    langTagged +=1;
                    if (sel(plist[j+k]).lang.indexOf(tabulator.lb.LanguagePreference) >=0) myLang ++; 
                }
            }
    

            var tr = propertyTR(myDocument, s, inverse);
            parent.appendChild(tr);
            var td_p = tr.firstChild; // we need to kludge the rowspan later

            var defaultpropview = views.defaults[s.predicate.uri];
            
                           
            /* Display only the one in the preferred language 
              ONLY in the case (currently) when all the values are tagged.
              Then we treat them as alternatives.*/
            
            if (myLang > 0 && langTagged == dups+1) {
                for (k=j; k <= j+dups; k++) {
                    if (sel(plist[k]).lang.indexOf(tabulator.lb.LanguagePreference) >=0) {
                        tr.appendChild(thisOutline.outline_objectTD(sel(plist[k]), defaultpropview, undefined, s))
                        break;
                    }
                }
                j += dups  // extra push
                continue;
            }
    
            tr.appendChild(thisOutline.outline_objectTD(sel(s), defaultpropview, undefined, s));
    
            /* Note: showNobj shows between n to 2n objects.
             * This is to prevent the case where you have a long list of objects
             * shown, and dangling at the end is '1 more' (which is easily ignored)
             * Therefore more objects are shown than hidden.
             */
             
            tr.showNobj = function(n){
                var predDups=k-dups;
                var show = ((2*n)<predDups) ? n: predDups;
                var showLaterArray=[];
                if (predDups!=1){
                    td_p.setAttribute('rowspan',(show==predDups)?predDups:n+1);
                    var l;
                    if ((show<predDups)&&(show==1)){ //what case is this...
                        td_p.setAttribute('rowspan',2)  
                    }
                    var displayed = 0; //The number of cells generated-1,
                                       //all duplicate thing removed
                    for(l=1;l<k;l++){
		      //This detects the same things
                        if (!kb.canon(sel(plist[j+l])).sameTerm(kb.canon(sel(plist[j+l-1])))){
                            displayed++;
                            s=plist[j+l];
                            defaultpropview = views.defaults[s.predicate.uri];
                            var trObj=myDocument.createElement('tr');
                            trObj.style.colspan='1';
                            trObj.appendChild(thisOutline.outline_objectTD(
                                sel(plist[j+l]),defaultpropview, undefined, s));
                            trObj.AJAR_statement=s;
                            trObj.AJAR_inverse=inverse;
                            parent.appendChild(trObj);
                            if (displayed>=show){
                                trObj.style.display='none';
                                showLaterArray.push(trObj);
                            }
                        } else {
                            //ToDo: show all the data sources of this statement
                            tabulator.log.info("there are duplicates here: %s", plist[j+l-1]);
                        }
                    }
		    //@@a quick fix on the messing problem.
		    if (show==predDups)
		      td_p.setAttribute('rowspan',displayed+1);
                } // end of if (predDups!=1)

                if (show<predDups){ //Add the x more <TR> here
                    var moreTR=myDocument.createElement('tr');
                    var moreTD=moreTR.appendChild(myDocument.createElement('td'));
                    if (predDups>n){ //what is this for??
                        var small=myDocument.createElement('a');
                        moreTD.appendChild(small);

                        var predToggle= (function(f){return f(td_p,k,dups,n);})(function(td_p,k,dups,n){
                        return function(display){
                            small.innerHTML="";
                            if (display=='none'){
                                small.appendChild(tabulator.Util.AJARImage(tabulator.Icon.src.icon_more, 'more', 'See all',myDocument));
                                    small.appendChild( myDocument.createTextNode((predDups-n) + ' more...'));
                                td_p.setAttribute('rowspan',n+1);
                            } else{
                                small.appendChild(tabulator.Util.AJARImage(tabulator.Icon.src.icon_shrink, '(less)',undefined,myDocument));
                                    td_p.setAttribute('rowspan',predDups+1);
                            }
                            for (var i=0; i<showLaterArray.length; i++){
                                var trObj = showLaterArray[i];
                                trObj.style.display = display;
                            }
                        }
                            }); //???
                            var current='none';
                        var toggleObj=function(event){
                            predToggle(current);
                            current=(current=='none')?'':'none';
                            if (event) event.stopPropagation();
                            return false; //what is this for?
                        }
                        toggleObj();
                        small.addEventListener('click', toggleObj, false); 
                        } //if(predDups>n)
                        parent.appendChild(moreTR);
                } // if
            } // tr.showNobj
    
            tr.showAllobj = function(){tr.showNobj(k-dups);};
            //tr.showAllobj();
            /*DisplayOptions["display:block on"].setupHere(
                    [tr,j,k,dups,td_p,plist,sel,inverse,parent,myDocument,thisOutline],
                    "appendPropertyTRs()");*/
            tr.showNobj(10);

            /*if (HCIoptions["bottom insert highlights"].enabled){
                var holdingTr=myDocument.createElement('tr');
                var holdingTd=myDocument.createElement('td');
                holdingTd.setAttribute('colspan','2');
                var bottomDiv=myDocument.createElement('div');
                bottomDiv.className='bottom-border';
                holdingTd.setAttribute('notSelectable','true');
                bottomDiv.addEventListener('mouseover',thisOutline.UserInput.Mouseover,false);
                bottomDiv.addEventListener('mouseout',thisOutline.UserInput.Mouseout,false);
                bottomDiv.addEventListener('click',thisOutline.UserInput.addNewPredicateObject,false);
                parent.appendChild(holdingTr).appendChild(holdingTd).appendChild(bottomDiv);
                }*/
        
            j += k-1  // extra push
        }
    } //  appendPropertyTRs

    this.appendPropertyTRs = appendPropertyTRs;

/*   termWidget
**
*/  
    termWidget={}
    termWidget.construct = function (myDocument) {
        myDocument = myDocument||document;                              
        td = myDocument.createElement('TD')
        td.setAttribute('class','iconTD')
        td.setAttribute('notSelectable','true')
        td.style.width = '0px';
        return td
    }
    termWidget.addIcon = function (td, icon) {
        var iconTD = td.childNodes[1];
        if (!iconTD) return;
        var width = iconTD.style.width;
        var img = tabulator.Util.AJARImage(icon.src,icon.alt,icon.tooltip,myDocument);
        width = parseInt(width);
        width = width + icon.width;
        iconTD.style.width = width+'px';
        iconTD.appendChild(img);
    }
    termWidget.removeIcon = function (td, icon) {
        var iconTD = td.childNodes[1];
        if (!iconTD) return;
        var width = iconTD.style.width;
        width = parseInt(width);
        width = width - icon.width;
        iconTD.style.width = width+'px';
        for (var x = 0; x<iconTD.childNodes.length; x++){
            var elt = iconTD.childNodes[x];
            var eltSrc = elt.src;
            
            // ignore first '?' and everything after it //Kenny doesn't know what this is for
            try{var baseURI = myDocument.location.href.split('?')[0];}
            catch(e){ dump(e);var baseURI="";}
            var relativeIconSrc = tabulator.rdf.Util.uri.join(icon.src,baseURI);
            if (eltSrc == relativeIconSrc) {
                iconTD.removeChild(elt);
            }
        }
    }
    termWidget.replaceIcon = function (td, oldIcon, newIcon) {
            termWidget.removeIcon (td, oldIcon)
            termWidget.addIcon (td, newIcon)
    }   
    
    
    
    ////////////////////////////////////////////////////// VALUE BROWSER VIEW

    ////////////////////////////////////////////////////////// TABLE VIEW

    //  Summarize a thing as a table cell

    /**********************
    
      query global vars 
    
    ***********************/
    
    // const doesn't work in Opera
    // const BLANK_QUERY = { pat: kb.formula(), vars: [], orderBy: [] };
    // @ pat: the query pattern in an RDFIndexedFormula. Statements are in pat.statements
    // @ vars: the free variables in the query
    // @ orderBy: the variables to order the table

    function queryObj() { 
            this.pat = kb.formula(), 
            this.vars = []
            // this.orderBy = [] 
    }
    
    var queries = [];
    myQuery=queries[0]=new queryObj();

    function query_save() {
        queries.push(queries[0]);
        var choices = myDocument.getElementById('queryChoices');
        var next = myDocument.createElement('option');
        var box = myDocument.createElement('input');
        var index = queries.length-1;
        box.setAttribute('type','checkBox');
        box.setAttribute('value',index);
        choices.appendChild(box);
        choices.appendChild(myDocument.createTextNode("Saved query #"+index));
        choices.appendChild(myDocument.createElement('br'));
            next.setAttribute("value",index);
            next.appendChild(myDocument.createTextNode("Saved query #"+index));
            myDocument.getElementById("queryJump").appendChild(next);
      }


    function resetQuery() {
            function resetOutliner(pat)
            {
            var i, n = pat.statements.length, pattern, tr;
            for (i=0; i<n; i++) {
                    pattern = pat.statements[i];
                    tr = pattern.tr;
                    //tabulator.log.debug("tr: " + tr.AJAR_statement);
                    if (typeof tr!='undefined')
                    {
                            delete tr.AJAR_pattern;
                            delete tr.AJAR_variable;
                    }
            }
            for (x in pat.optional)
                    resetOutliner(pat.optional[x])
        }
        resetOutliner(myQuery.pat)
        tabulator.Util.clearVariableNames();
        queries[0]=myQuery=new queryObj();
    }

    function AJAR_ClearTable() {
        resetQuery();
        var div = myDocument.getElementById('results');
        tabulator.Util.emptyNode(div);
        return false;
    } //AJAR_ClearTable
    
    function addButtonCallbacks(target, fireOn) {
        tabulator.log.debug("Button callbacks for " + fireOn + " added")
        var makeIconCallback = function (icon) {
            return function IconCallback(req) {
                if (req.indexOf('#') >= 0) alert('Should have no hash in '+req)
                if (!target) {
                    return false
                }          
                if (!outline.ancestor(target,'DIV')) return false;
                // if (term.termType != "symbol") { return true } // should always ve
                if (req == fireOn) {
                    target.src = icon
                    target.title = tabulator.Icon.tooltips[icon]
                }
                return true
            }
        }
        sf.addCallback('request',makeIconCallback(tabulator.Icon.src.icon_requested))
        sf.addCallback('done',makeIconCallback(tabulator.Icon.src.icon_fetched))
        sf.addCallback('fail',makeIconCallback(tabulator.Icon.src.icon_failed))
    }
    
    //   Selection support
    
    function selected(node) {
        var a = node.getAttribute('class')
        if (a && (a.indexOf('selected') >= 0)) return true
        return false
    }

    function setSelectedParent(node, inc) {
        var onIcon = tabulator.Icon.termWidgets.optOn;
            var offIcon = tabulator.Icon.termWidgets.optOff;
            for (var n = node; n.parentNode; n=n.parentNode)
            {
            while (true)
            {
                if (n.getAttribute('predTR'))
                {
                    var num = n.getAttribute('parentOfSelected')
                    if (!num) num = 0;
                    else num = parseInt(num);
                    if (num==0 && inc>0) termWidget.addIcon(n.childNodes[0],n.getAttribute('optional')?onIcon:offIcon)
                    num = num+inc;
                    n.setAttribute('parentOfSelected',num)
                    if (num==0) 
                    {
                        n.removeAttribute('parentOfSelected')
                        termWidget.removeIcon(n.childNodes[0],n.getAttribute('optional')?onIcon:offIcon)
                    }
                    break;
                }
                else if (n.previousSibling && n.previousSibling.nodeName == 'TR')
                    n=n.previousSibling;
                else break;
            }
        }
    }
    
    this.statusBarClick = function(event) {
        var target = tabulator.Util.getTarget(event);
        if (target.label) {
            window.content.location = target.label;
            // The following alternative does not work in the extension.
            // var s = tabulator.kb.sym(target.label);
            // tabulator.outline.GotoSubject(s, true);
        }
    };

    this.showURI = function showURI(about){
        if(about && myDocument.getElementById('UserURI')) { 
             myDocument.getElementById('UserURI').value = 
                  (about.termType == 'symbol') ? about.uri : ''; // blank if no URI
         } else if(about && tabulator.isExtension) {
             var tabStatusBar = gBrowser.ownerDocument.getElementById("tabulator-display");
             tabStatusBar.setAttribute('style','display:block');
             tabStatusBar.label = (about.termType == 'symbol') ? about.uri : ''; // blank if no URI
             if(tabStatusBar.label=="") {
                 tabStatusBar.setAttribute('style','display:none');
             } else {
                 tabStatusBar.addEventListener('click', this.statusBarClick, false);
             }
         }    
    };



    this.showSource = function showSource(){
        //deselect all before going on, this is necessary because you would switch tab,
        //close tab or so on...
        for (var uri in sourceWidget.sources)
            sourceWidget.sources[uri].setAttribute('class', ''); //.class doesn't work. Be careful!
        for (var i=0;i<selection.length;i++){
            if (!selection[i].parentNode) {
                dump("showSource: EH? no parentNode? "+selection[i]+"\n");
                continue;
            }
            var st = selection[i].parentNode.AJAR_statement;
            if (!st) continue; //for root TD
            var source = st.why;
            if (source && source.uri) 
                sourceWidget.highlight(source, true);
            else if (tabulator.isExtension && source.termType == 'bnode')
                sourceWidget.highlight(kb.sym(tabulator.sourceURI), true);
        }
    };
    
    this.getSelection = function getSelection() {
        return selection;
    };
    
    function setSelected(node, newValue) {
        //tabulator.log.info("selection has " +selection.map(function(item){return item.textContent;}).join(", "));
        //tabulator.log.debug("@outline setSelected, intended to "+(newValue?"select ":"deselect ")+node+node.textContent);   
        //if (newValue == selected(node)) return; //we might not need this anymore...
        if (node.nodeName != 'TD') {tabulator.log.debug('down'+node.nodeName);throw 'Expected TD in setSelected: '+node.nodeName+node.textContent;}
        tabulator.log.debug('pass');
        var cla = node.getAttribute('class')
        if (!cla) cla = ""
        if (newValue) {
            cla += ' selected'
            if (cla.indexOf('pred') >= 0 || cla.indexOf('obj') >=0 ) setSelectedParent(node,1)
            selection.push(node)
            //tabulator.log.info("Selecting "+node.textContent)

            var about=tabulator.Util.getTerm(node); //show uri for a newly selectedTd
            thisOutline.showURI(about);
            //if(tabulator.isExtension && about && about.termType=='symbol') gURLBar.value = about.uri;
                           //about==null when node is a TBD
                         
            var st = node.AJAR_statement; //show blue cross when the why of that triple is editable
            if (typeof st == 'undefined') st = node.parentNode.AJAR_statement;
            //if (typeof st == 'undefined') return; // @@ Kludge?  Click in the middle of nowhere
            if (st) { //don't do these for headers or base nodes
            var source = st.why;
            var target = st.why;
            var editable = tabulator.sparql.editable(source.uri, kb);
            if (!editable)
                target = node.parentNode.AJAR_inverse ? st.object : st.subject; // left hand side
                //think about this later. Because we update to the why for now.
            // alert('Target='+target+', editable='+editable+'\nselected statement:' + st)
            if (editable && (cla.indexOf('pred') >= 0))
                termWidget.addIcon(node,tabulator.Icon.termWidgets.addTri); // Add blue plus
            }
            
        } else {
            tabulator.log.debug("cla=$"+cla+"$")
            if (cla=='selected') cla=''; // for header <TD>
            cla = cla.replace(' selected','')
            if (cla.indexOf('pred') >= 0 || cla.indexOf('obj') >=0 ) setSelectedParent(node,-1)
            if (cla.indexOf('pred') >=0)
                termWidget.removeIcon(node,tabulator.Icon.termWidgets.addTri);

            selection = selection.filter( function(x) { return x==node } );

            tabulator.log.info("Deselecting "+node.textContent);
        }
        if (sourceWidget) thisOutline.showSource(); // Update the data sources display
        //tabulator.log.info("selection becomes [" +selection.map(function(item){return item.textContent;}).join(", ")+"]");
        //tabulator.log.info("Setting className " + cla);
        node.setAttribute('class', cla)
    }

    function deselectAll() {
        var i, n=selection.length
        for (i=n-1; i>=0; i--) setSelected(selection[i], false);
        selection = [];
    }
    
    /////////  Hiding

    this.AJAR_hideNext = function(event) {
        var target = tabulator.Util.getTarget(event)
        var div = target.parentNode.nextSibling
        for (; div.nodeType != 1; div = div.nextSibling) {}
        if (target.src.indexOf('collapse') >= 0) {
            div.setAttribute('class', 'collapse')
            target.src = tabulator.Icon.src.icon_expand
        } else {
            div.removeAttribute('class')
            target.scrollIntoView(true)
            target.src = tabulator.Icon.src.icon_collapse
        }
    }

    this.TabulatorDoubleClick =function(event) {
        var target = tabulator.Util.getTarget(event);
        var tname = target.tagName;
        tabulator.log.debug("TabulatorDoubleClick: " + tname + " in "+target.parentNode.tagName);
        if (tname == "IMG") return; // icons only click once, panes toggle on second click
        var aa = tabulator.Util.getAbout(kb, target);
        if (!aa) return;
            this.GotoSubject(aa,true);
    }

    function ResultsDoubleClick(event) {    
        var target = tabulator.Util.getTarget(event);
        var aa = tabulator.Util.getAbout(kb, target)
        if (!aa) return;
        this.GotoSubject(aa,true);
    }

    /** get the target of an event **/  
    this.targetOf=function(e) {
        var target;
        if (!e) var e = window.event
        if (e.target) 
            target = e.target
        else if (e.srcElement) 
        target = e.srcElement
        else {
            tabulator.log.error("can't get target for event " + e);
            return false;
        } //fail
        if (target.nodeType == 3) // defeat Safari bug [sic]
            target = target.parentNode;
        return target;
    } //targetOf


    this.walk = function walk(directionCode,inputTd){
         var selectedTd=inputTd||selection[0];
         var newSelTd;
         switch (directionCode){
             case 'down':
                 try{newSelTd=selectedTd.parentNode.nextSibling.lastChild;}catch(e){
                     this.walk('up');
                     return;
                 }//end
                 deselectAll();
                 setSelected(newSelTd,true);
                 break;
             case 'up':
                 try{newSelTd=selectedTd.parentNode.previousSibling.lastChild;}catch(e){return;}//top
                 deselectAll();
                 setSelected(newSelTd,true);
                 break;
             case 'right':
                 deselectAll();
                 if (selectedTd.nextSibling||selectedTd.lastChild.tagName=='strong')
                     setSelected(selectedTd.nextSibling,true);
                 else{
                     var newSelected=myDocument.evaluate('table/div/tr/td[2]',selectedTd,
                                                        null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
                     setSelected(newSelected,true);
                 }
                 break;
             case 'left':
                 deselectAll();
                 if (selectedTd.previousSibling && selectedTd.previousSibling.className=='undetermined'){
                     setSelected(selectedTd.previousSibling,true);
                     return true; //do not shrink signal
                 }
                 else
                     setSelected(tabulator.Util.ancestor(selectedTd.parentNode,'TD'),true); //supplied by thieOutline.focusTd
                 break;
             case 'moveTo':
                 //tabulator.log.info(selection[0].textContent+"->"+inputTd.textContent);
                 deselectAll();
                 setSelected(inputTd,true);
                 break;          
         }
         if (directionCode=='down'||directionCode=='up') 
             if (!newSelTd.tabulatorSelect) this.walk(directionCode);
         //return newSelTd;
    }
    
    //Keyboard Input: we can consider this as...
    //1. a fast way to modify data - enter will go to next predicate
    //2. an alternative way to input - enter at the end of a predicate will create a new statement
    this.OutlinerKeypressPanel=function OutlinerKeypressPanel(e){
        tabulator.log.info("Key "+e.keyCode+" pressed");
        function showURI(about){
            if(about && myDocument.getElementById('UserURI')) { 
                    myDocument.getElementById('UserURI').value = 
                         (about.termType == 'symbol') ? about.uri : ''; // blank if no URI
            }
        }

        if (tabulator.Util.getTarget(e).tagName=='TEXTAREA') return;
            if (tabulator.Util.getTarget(e).id=="UserURI") return;
            if (selection.length>1) return;
            if (selection.length==0){
                if (e.keyCode==13||e.keyCode==38||e.keyCode==40||e.keyCode==37||e.keyCode==39){
                    this.walk('right',thisOutline.focusTd);
                    showURI(tabulator.Util.getAbout(kb,selection[0]));            
                }    
                return;    
        }
        var selectedTd=selection[0];
        //if not done, Have to deal with redraw...
        sf.removeCallback('done',"setSelectedAfterward");
        sf.removeCallback('fail',"setSelectedAfterward");
        
        switch (e.keyCode){
            case 13://enter
                if (tabulator.Util.getTarget(e).tagName=='HTML'){ //I don't know why 'HTML'                   
                    var object=tabulator.Util.getAbout(kb,selectedTd);
                    var target = selectedTd.parentNode.AJAR_statement.why;
                    var editable = tabulator.sparql.editable(target.uri, kb);                    
                    if (object){
                        //<Feature about="enterToExpand"> 
                        outline.GotoSubject(object,true);
                        /* //deal with this later 
                        deselectAll();
                        var newTr=myDocument.getElementById('outline').lastChild;                
                        setSelected(newTr.firstChild.firstChild.childNodes[1].lastChild,true);
                        function setSelectedAfterward(uri){
                            deselectAll();
                            setSelected(newTr.firstChild.firstChild.childNodes[1].lastChild,true);
                            showURI(getAbout(kb,selection[0]));
                            return true;                        
                        }
                        sf.insertCallback('done',setSelectedAfterward);
                        sf.insertCallback('fail',setSelectedAfterward);
                        */
                        //</Feature>                                                   
                    } else if (editable) {//this is a text node and editable
                        thisOutline.UserInput.Enter(selectedTd);
                    }
                
                }else{
                //var newSelTd=thisOutline.UserInput.lastModified.parentNode.parentNode.nextSibling.lastChild;
                this.UserInput.Keypress(e);
                var notEnd=this.walk('down');//bug with input at the end
                //myDocument.getElementById('docHTML').focus(); //have to set this or focus blurs
                e.stopPropagation();
                }
                return;      
            case 38://up
                //thisOutline.UserInput.clearInputAndSave(); 
                //^^^ does not work because up and down not captured...
                this.walk('up');
                e.stopPropagation();
                e.preventDefault();
                break;
            case 40://down
                //thisOutline.UserInput.clearInputAndSave();
                this.walk('down');
                e.stopPropagation();
                e.preventDefault();
        } // switch
        
        if (tabulator.Util.getTarget(e).tagName=='INPUT') return;
        
        switch (e.keyCode){
            case 46://delete
            case 8://backspace
                var target = selectedTd.parentNode.AJAR_statement.why;
                var editable = tabulator.sparql.editable(target.uri, kb);
                if (editable){                                
                    e.preventDefault();//prevent from going back
                    this.UserInput.Delete(selectedTd);
                }
                break;
            case 37://left
                if (this.walk('left')) return;
                var titleTd=tabulator.Util.ancestor(selectedTd.parentNode,'TD');
                outline_collapse(selectedTd,tabulator.Util.getAbout(kb,titleTd));
                break;
            case 39://right
                var obj=tabulator.Util.getAbout(kb,selectedTd);
                if (obj){
                    var walk=this.walk;
                    function setSelectedAfterward(uri){
                        if (arguments[3]) return true;
                        walk('right',selectedTd);
                        showURI(tabulator.Util.getAbout(kb,selection[0]));
                        return true;
                    }
                    if (selectedTd.nextSibling) { //when selectedTd is a predicate
                        this.walk('right');
                        return;
                    }
                    if (selectedTd.firstChild.tagName!='TABLE'){//not expanded
                        sf.addCallback('done',setSelectedAfterward);
                        sf.addCallback('fail',setSelectedAfterward);
                        outline_expand(selectedTd, obj, tabulator.panes.defaultPane);
                    }
                    setSelectedAfterward();                   
                }
                break;
            case 38://up
            case 40://down
                break;    
            default:
                switch(e.charCode){
                    case 99: //c for Copy
                        if (e.ctrlKey){
                            thisOutline.UserInput.copyToClipboard(thisOutline.clipboardAddress,selectedTd);
                        break;
                        }
                    case 118: //v
                    case 112: //p for Paste
                        if (e.ctrlKey){
                            thisOutline.UserInput.pasteFromClipboard(thisOutline.clipboardAddress,selectedTd);
                            //myDocument.getElementById('docHTML').focus(); //have to set this or focus blurs
                            //window.focus();
                            //e.stopPropagation();                   
                            break;
                        }
                    default:
                    if (tabulator.Util.getTarget(e).tagName=='HTML'){
                    /*
                    //<Feature about="typeOnSelectedToInput">
                    thisOutline.UserInput.Click(e,selectedTd);
                    thisOutline.UserInput.lastModified.value=String.fromCharCode(e.charCode);
                    if (selectedTd.className=='undetermined selected') thisOutline.UserInput.AutoComplete(e.charCode)
                    //</Feature>
                    */
                    //Events are not reliable...
                    //var e2=document.createEvent("KeyboardEvent");
                    //e2.initKeyEvent("keypress",true,true,null,false,false,false,false,e.keyCode,0);
                    //UserInput.lastModified.dispatchEvent(e2);
                }
            }
        }//end of switch

    showURI(tabulator.Util.getAbout(kb,selection[0]));
    //alert(window);alert(doc);
    /*
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
               .getService(Components.interfaces.nsIWindowMediator);
    var gBrowser = wm.getMostRecentWindow("navigator:browser")*/
    //gBrowser.addTab("http://www.w3.org/");
    //alert(gBrowser.addTab);alert(gBrowser.scroll);alert(gBrowser.scrollBy)
    //gBrowser.scrollBy(0,100);
    
    //var thisHtml=selection[0].owner
    if (selection[0]){   
            var PosY=tabulator.Util.findPos(selection[0])[1];
            if (PosY+selection[0].clientHeight > window.scrollY+window.innerHeight) tabulator.Util.getEyeFocus(selection[0],true,true,window);
            if (PosY<window.scrollY+54) tabulator.Util.getEyeFocus(selection[0],true,undefined,window);
        }
    };
    this.OutlinerMouseclickPanel=function(e){
        switch(thisOutline.UserInput._tabulatorMode){
            case 0:
                TabulatorMousedown(e);
                break;
            case 1:
                thisOutline.UserInput.Click(e);
                break;
            default:
        }
    }

    /** things to do onmousedown in outline view **/
    /*
    **   To Do:  This big event hander needs to be replaced by lots
    ** of little ones individually connected to each icon.  This horrible
    ** switch below isn't modular. (Sorry!) - Tim
    */
    // expand
    // collapse
    // refocus
    // select
    // visit/open a page    
    function TabulatorMousedown(e) {
        tabulator.log.info("@TabulatorMousedown, myDocument.location is now " + myDocument.location);
        var target = thisOutline.targetOf(e);
        if (!target) return;
        var tname = target.tagName;
        //tabulator.log.debug("TabulatorMousedown: " + tname + " shift="+e.shiftKey+" alt="+e.altKey+" ctrl="+e.ctrlKey);
        var p = target.parentNode;
        var about = tabulator.Util.getAbout(kb, target);
        var source = null;
        if (tname == "INPUT" || tname == "TEXTAREA") {
            return
        }
        //not input then clear
        thisOutline.UserInput.clearMenu();
        //ToDo:remove this and recover X
        if (thisOutline.UserInput.lastModified&&
            thisOutline.UserInput.lastModified.parentNode.nextSibling) thisOutline.UserInput.backOut();
        if (tname != "IMG") {
            /*
            if(about && myDocument.getElementById('UserURI')) { 
                myDocument.getElementById('UserURI').value = 
                     (about.termType == 'symbol') ? about.uri : ''; // blank if no URI
            } else if(about && tabulator.isExtension) {
                var tabStatusBar = gBrowser.ownerDocument.getElementById("tabulator-display");
                tabStatusBar.setAttribute('style','display:block');
                tabStatusBar.label = (about.termType == 'symbol') ? about.uri : ''; // blank if no URI
                if(tabStatusBar.label=="") {
                    tabStatusBar.setAttribute('style','display:none');
                }
            }
            */
            var node;
            for (node = tabulator.Util.ancestor(target, 'TD');
                 node && node.getAttribute('notSelectable');
                 node = tabulator.Util.ancestor(node.parentNode, 'TD')) {}
            if (!node) return;
            var sel = selected(node);
            var cla = node.getAttribute('class')
            tabulator.log.debug("Was node selected before: "+sel)
            if (e.altKey) {
                setSelected(node, !selected(node))
            } else if  (e.shiftKey) {
                setSelected(node, true)
            } else {
                //setSelected(node, !selected(node))
                deselectAll()
                thisOutline.UserInput.clearInputAndSave(e);   
                setSelected(node, true)
                
                if (e.detail==2){//dobule click -> quit TabulatorMousedown()
                    e.stopPropagation();
                    return;
                }
                //if the node is already selected and the correspoding statement is editable,
                //go to UserInput
                var st = node.parentNode.AJAR_statement;
                if (!st) return; // For example in the title TD of an expanded pane
                var target = st.why;
                var editable = tabulator.sparql.editable(target.uri, kb);
                if (sel && editable) thisOutline.UserInput.Click(e, selection[0]); // was next 2 lines
                // var text="TabulatorMouseDown@Outline()";
                // HCIoptions["able to edit in Discovery Mode by mouse"].setupHere([sel,e,thisOutline,selection[0]],text); 
            }
            tabulator.log.debug("Was node selected after: "+selected(node)
                +", count="+selection.length)
                var tr = node.parentNode;
                if (tr.AJAR_statement) {
                    var why = tr.AJAR_statement.why
                    //tabulator.log.info("Information from "+why);
                }
            e.stopPropagation();
            return; //this is important or conflict between deslect and userinput happens
        } else { // IMG
            var tsrc = target.src
            var outer
            var i = tsrc.indexOf('/icons/')
            //TODO: This check could definitely be made cleaner.
            // if (i >=0 && tsrc.search('chrome://tabulator/content/icons') == -1) tsrc=tsrc.slice(i+1) // get just relative bit we use
            tabulator.log.debug("\nEvent: You clicked on an image, src=" + tsrc)
            tabulator.log.debug("\nEvent: about=" + about)
									   
										//@@ What's the reason for the following check?	  
            if (!about && tsrc!=tabulator.Icon.src.icon_add_new_triple
		       && tsrc!=tabulator.Icon.src.icon_display_reasons) {
                //alert("No about attribute");
                return;
            }
            var subject = about;
            tabulator.log.debug("TabulatorMousedown: subject=" + subject);
            
            switch (tsrc) {
            case tabulator.Icon.src.icon_expand:
            case tabulator.Icon.src.icon_collapse:
                var pane = e.altKey? tabulator.panes.internalPane : undefined; // set later: was tabulator.panes.defaultPane
                var mode = e.shiftKey ? outline_refocus :
                    (tsrc == tabulator.Icon.src.icon_expand ? outline_expand : outline_collapse);
                mode(p, subject, pane);
                break;
                //  case Icon.src.icon_visit:
                //emptyNode(p.parentNode).appendChild(documentContentTABLE(subject));
                //document.url = subject.uri;   // How to jump to new page?
                //var newWin = window.open(''+subject.uri,''+subject.uri,'width=500,height=500,resizable=1,scrollbars=1');
                //newWin.focus();
                //break;
            case tabulator.Icon.src.icon_failed:
            case tabulator.Icon.src.icon_fetched:
                var uri = target.getAttribute('uri'); // Put on access buttons
                sf.refresh(kb.sym(tabulator.rdf.Util.uri.docpart(uri))); // just one
                // sf.objectRefresh(subject);
                break;
            case tabulator.Icon.src.icon_unrequested:
                var uri = target.getAttribute('uri'); // Put on access buttons
                if (!uri) alert('Interal error: No URI on unrequested icon! @@');
                sf.requestURI(tabulator.rdf.Util.uri.docpart(uri))
                // if (subject.uri) sf.lookUpThing(subject);
                break;
            case tabulator.Icon.src.icon_opton:
            case tabulator.Icon.src.icon_optoff:
                oldIcon = (tsrc==tabulator.Icon.src.icon_opton)? tabulator.Icon.termWidgets.optOn : tabulator.Icon.termWidgets.optOff;
                newIcon = (tsrc==tabulator.Icon.src.icon_opton)? tabulator.Icon.termWidgets.optOff : tabulator.Icon.termWidgets.optOn;
                termWidget.replaceIcon(p.parentNode,oldIcon,newIcon);
                if (tsrc==tabulator.Icon.src.icon_opton)
                    p.parentNode.parentNode.removeAttribute('optional');
                else p.parentNode.parentNode.setAttribute('optional','true');
                break;
            case tabulator.Icon.src.icon_remove_node:
                var node = target.node;
                if (node.childNodes.length>1) node=target.parentNode; //parallel outline view @@ Hack
                removeAndRefresh(node); // @@ update icons for pane?
                
                break;
            case tabulator.Icon.src.icon_map:
                var node = target.node;
                    setSelected(node, true);
                    viewAndSaveQuery();
                break;
            case tabulator.Icon.src.icon_add_triple:
                var returnSignal=thisOutline.UserInput.addNewObject(e);
                if (returnSignal){ //when expand signal returned
                    outline_expand(returnSignal[0],returnSignal[1],internalPane);
                    for (var trIterator=returnSignal[0].firstChild.childNodes[1].firstChild;
                        trIterator; trIterator=trIterator.nextSibling) {
                        var st=trIterator.AJAR_statement;
                        if (!st) continue;
                        if (st.predicate.termType=='collection') break;
                    }
                    thisOutline.UserInput.Click(e,trIterator.lastChild);
                    thisOutline.walk('moveTo',trIterator.lastChild);
                }
                //thisOutline.UserInput.clearMenu();
                e.stopPropagation();
                e.preventDefault();
                return;
                break;
            case tabulator.Icon.src.icon_add_new_triple:
                thisOutline.UserInput.addNewPredicateObject(e);
                e.stopPropagation();
                e.preventDefault();
                return;
                break;     
            case tabulator.Icon.src.icon_show_choices: // @what is this? A down-traingle like 'collapse'
                /*  SELECT ?pred 
                            WHERE{
                            about tabont:element ?pred.
                                }
                */
                // Query Error because of getAbout->kb.fromNT
                var choiceQuery=SPARQLToQuery(
                    "SELECT ?pred\nWHERE{ "+about+ tabulator.ns.link('element')+" ?pred.}");
                thisOutline.UserInput.showMenu(e,'LimitedPredicateChoice',
                    choiceQuery,{'clickedTd':p.parentNode});
                break;
            case tabulator.Icon.src.icon_display_reasons:
                if(!tabulator.isExtension) return;
                var TMS = RDFNamespace('http://dig.csail.mit.edu/TAMI/2007/amord/tms#');
                var st_to_explain = tabulator.Util.ancestor(target, 'TR').AJAR_statement;
                //the 'explanationID' triples are used to pass the information
                //about the triple to be explained to the new tab
                var one_statement_formula = new RDFIndexedFormula();
                one_statement_formula.statements.push(st_to_explain);
                var explained = kb.any(one_statement_formula,
                                       TMS('explanationID'));
                if(!explained){
                    var explained_number = kb.each(undefined, 
                                           TMS('explanationID')).length;
                    kb.add(one_statement_formula, TMS('explanationID'),
                           kb.literal(String(explained_number)));
                } else
                    var explained_number = explained.value;

                //open new tab
                gBrowser.selectedTab = gBrowser.addTab('chrome://tabulator/content/justification.html?explanationID=' + explained_number);
                break;
            default:  // Look up any icons for panes
                // paneButtonClick(@@@)
           }
        }  // else IMG
        //if (typeof rav=='undefined') //uncommnet this for javascript2rdf
        //have to put this here or this conflicts with deselectAll()
        if (!target.src||(target.src.slice(target.src.indexOf('/icons/')+1)!=tabulator.Icon.src.icon_show_choices
                       &&target.src.slice(target.src.indexOf('/icons/')+1)!=tabulator.Icon.src.icon_add_triple))
            thisOutline.UserInput.clearInputAndSave(e);
        if (!target.src||target.src.slice(target.src.indexOf('/icons/')+1)!=tabulator.Icon.src.icon_show_choices)        
            thisOutline.UserInput.clearMenu();
        if (e) e.stopPropagation();
    } //function
    

 
    function outline_expand(p, subject1, pane, already) {
        tabulator.log.info("@outline_expand, myDocument is now " + myDocument.location);
        //remove callback to prevent unexpected repaint
        sf.removeCallback('done','expand');
        sf.removeCallback('fail','expand');
        
        var subject = kb.canon(subject1)
        var requTerm = subject.uri?kb.sym(tabulator.rdf.Util.uri.docpart(subject.uri)):subject
        var subj_uri = subject.uri
        var already = !!already
        
        function render() {
            subject = kb.canon(subject)
            if (!p || !p.parentNode || !p.parentNode.parentNode) return false
    
            var newTable
            tabulator.log.info('@@ REPAINTING ')
            if (!already) { // first expand
                newTable = propertyTable(subject, undefined, pane)
            } else {
                   
                tabulator.log.info(" ... p is  " + p);
                for (newTable = p.firstChild; newTable.nextSibling;
                     newTable = newTable.nextSibling) {
                    tabulator.log.info(" ... checking node "+newTable);
                    if (newTable.nodeName == 'table') break
                }
                newTable = propertyTable(subject, newTable, pane)
            }
            already = true
            if (tabulator.Util.ancestor(p, 'TABLE') && tabulator.Util.ancestor(p, 'TABLE').style.backgroundColor=='white') {
                newTable.style.backgroundColor='#eee'
            } else {
                newTable.style.backgroundColor='white'
            }
            try{if (YAHOO.util.Event.off) YAHOO.util.Event.off(p,'mousedown','dragMouseDown');}catch(e){dump("YAHOO")}
            tabulator.Util.emptyNode(p).appendChild(newTable)
            thisOutline.focusTd=p; //I don't know why I couldn't use 'this'...
            tabulator.log.debug("expand: Node for " + subject + " expanded")
            //fetch seeAlso when render()
            //var seeAlsoStats = sf.store.statementsMatching(subject, tabulator.ns.rdfs('seeAlso'))
            //seeAlsoStats.map(function (x) {sf.lookUpThing(x.object, subject,false);})
            var seeAlsoWhat = kb.each(subject, rdfs('seeAlso'));
            for (var i=0;i<seeAlsoWhat.length;i++){
                if (i == 25) {
                    tabulator.log.warn("expand: Warning: many (" +
                        seeAlsoWhat.length + ") seeAlso links for "+ subject)
                    // break; Not sure what limits the AJAX system has here
                }
                sf.lookUpThing(seeAlsoWhat[i],subject,false);
            }
        } 
    
        function expand(uri)  {
            if (arguments[3]) return true;//already fetched indicator
            var cursubj = kb.canon(subject);  // canonical identifier may have changed
                tabulator.log.info('@@ expand: relevant subject='+cursubj+', uri='+uri+', already='+already)
            var term = kb.sym(uri)
            var docTerm = kb.sym(tabulator.rdf.Util.uri.docpart(uri))
            if (uri.indexOf('#') >= 0) 
                throw "Internal error: hash in "+uri;
            
            var relevant = function() {  // Is the loading of this URI relevam to the display of subject?
                if (!cursubj.uri) return true;  // bnode should expand() 
                //doc = cursubj.uri?kb.sym(tabulator.rdf.Util.uri.docpart(cursubj.uri)):cursubj
                as = kb.uris(cursubj)
                if (!as) return false;
                for (var i=0; i<as.length; i++) {  // canon'l uri or any alias
                    for (var rd = tabulator.rdf.Util.uri.docpart(as[i]); rd; rd = kb.HTTPRedirects[rd]) {
                        if (uri == rd) return true;
                    }
                }
                if (kb.anyStatementMatching(cursubj,undefined,undefined,docTerm)) return true; //Kenny: inverse?
                return false;
            }
            if (relevant()) {
                tabulator.log.success('@@ expand OK: relevant subject='+cursubj+', uri='+uri+', source='+
                    already)
                    
                render()
            }
            return true
        }
        // Body of outline_expand
        tabulator.log.debug("outline_expand: dereferencing "+subject)
        var status = myDocument.createElement("span")
        p.appendChild(status)
        sf.addCallback('done', expand)
        sf.addCallback('fail', expand)
        /*
        sf.addCallback('request', function (u) {
                           if (u != subj_uri) { return true }
                           status.textContent=" requested..."
                           return false
                       })
        sf.addCallback('recv', function (u) {
                           if (u != subj_uri) { return true }
                           status.textContent=" receiving..."
                           return false
                       })
        sf.addCallback('load', function (u) {
                           if (u != subj_uri) { return true }
                           status.textContent=" parsing..."
                           return false
                       })
        */ //these are not working as we have a pre-render();
                       
        var returnConditions=[]; //this is quite a general way to do cut and paste programming
                                 //I might make a class for this
        if (subject.uri && subject.uri.split(':')[0]=='rdf') {   // what is this? -tim
            render()
            return;
        }

        for (var i=0; i<returnConditions.length; i++){
            var returnCode;
            if (returnCode=returnConditions[i](subject)){
                render();
                tabulator.log.debug('outline 1815')
                if (returnCode[1]) outlineElement.removeChild(outlineElement.lastChild);
                return;
            }
        }
        sf.lookUpThing(subject);
        render()  // inital open, or else full if re-open
        tabulator.log.debug('outline 1821')
    
    } //outline_expand
    
    
    function outline_collapse(p, subject) {
        var row = tabulator.Util.ancestor(p, 'TR');
        row = tabulator.Util.ancestor(row.parentNode, 'TR'); //two levels up
        if (row) var statement = row.AJAR_statement;
        var level; //find level (the enclosing TD)
        for (level=p.parentNode; level.tagName != "TD";
                level=level.parentNode) {
            if (typeof level == 'undefined') {
                alert("Not enclosed in TD!")
                return
            }
        }
                            
        tabulator.log.debug("Collapsing subject "+subject);
        var myview;
        if (statement) {
            tabulator.log.debug("looking up pred " + statement.predicate.uri + "in defaults");
            myview = views.defaults[statement.predicate.uri];
        }
        tabulator.log.debug("view= " + myview);
        if (level.parentNode.parentNode.id == 'outline') {
            var deleteNode = level.parentNode
        }
        thisOutline.replaceTD(thisOutline.outline_objectTD(subject,myview,deleteNode,statement),level);                                                
    } //outline_collapse
    
    this.replaceTD = function replaceTD(newTd,replacedTd){
        var reselect;
        if (selected(replacedTd)) reselect=true;
        
        //deselects everything being collapsed. This goes backwards because
        //deselecting an element decreases selection.length        
        for (var x=selection.length-1;x>-1;x--)
            for (var elt=selection[x];elt.parentNode;elt=elt.parentNode)
                if (elt===replacedTd)
                    setSelected(selection[x],false)
                    
        replacedTd.parentNode.replaceChild(newTd, replacedTd);
        if (reselect) setSelected(newTd,true);                             
    }
    
    function outline_refocus(p, subject) { // Shift-expand or shift-collapse: Maximize
        if(tabulator.isExtension && subject.termType == "symbol" && subject.uri.indexOf('#')<0) {
            gBrowser.selectedBrowser.loadURI(subject.uri);
            return;   
        }
        var outer = null
        for (var level=p.parentNode; level; level=level.parentNode) {
            tabulator.log.debug("level "+ level.tagName)
            if (level.tagName == "TD") outer = level
        } //find outermost td
        tabulator.Util.emptyNode(outer).appendChild(propertyTable(subject));
        myDocument.title = tabulator.Util.label("Tabulator: "+subject);
        outer.setAttribute('about', subject.toNT());
    } //outline_refocus
    
    outline.outline_refocus = outline_refocus;
    
    // Inversion is turning the outline view inside-out
    function outline_inversion(p, subject) { // re-root at subject
    
        function move_root(rootTR, childTR) { // swap root with child
        // @@
        }
    
    }

    this.GotoFormURI_enterKey = function(e) {
        if (e.keyCode==13) outline.GotoFormURI(e);
    }
    this.GotoFormURI = function(e) {
        GotoURI(myDocument.getElementById('UserURI').value);
    }
    function GotoURI(uri) {
            var subject = kb.sym(uri)
            this.GotoSubject(subject, true);
    }
    this.GotoURIinit = function(uri){
            var subject = kb.sym(uri)
            this.GotoSubject(subject)
    }
    
    // Display the subject in an outline view
    //
    // subject -- RDF term for teh thing to be presented
    // expand  -- flag -- open the subject rather tahn keep folded closed
    // pane    -- optional -- pane to be used for exanded display
    // solo    -- optional -- the window will be cleared out and only the subject displayed
    // referer -- optional -- where did we hear about this from anyway?
    // table   -- option  -- a table element in which to put the outline.
    
    this.GotoSubject = function(subject, expand, pane, solo, referrer, table) {
        tabulator.log.error("@@ outline.js test 50 tabulator.log.error: $rdf.log.error)"+$rdf.log.error);
        if (!table) table = myDocument.getElementById('outline');
        if (solo) tabulator.Util.emptyNode(table);
        
        function GotoSubject_default(){
            var tr = myDocument.createElement("TR");
            tr.style.verticalAlign="top";
            table.appendChild(tr);
            var td = thisOutline.outline_objectTD(subject, undefined, tr)
    
            tr.appendChild(td)
            return td
        }
        function GotoSubject_option() {
            var lastTr=table.lastChild;
            if (lastTr)
                return lastTr.appendChild(outline.outline_objectTD(subject,undefined,true));
        }

        if (tabulator.isExtension) newURI = function(spec) {
            // e.g. see http://www.nexgenmedia.net/docs/protocol/
            const kSIMPLEURI_CONTRACTID = "@mozilla.org/network/simple-uri;1";
            const nsIURI = Components.interfaces.nsIURI;
            var uri = Components.classes[kSIMPLEURI_CONTRACTID].createInstance(nsIURI);
            uri.spec = spec;
            return uri;
        }
        var td = GotoSubject_default();
        if (!td) td = GotoSubject_default(); //the first tr is required       
        if (expand) {
            outline_expand(td, subject, pane);
            myDocument.title = tabulator.Util.label(subject);  // "Tabulator: "+  No need to advertize
            tr=td.parentNode;
            tabulator.Util.getEyeFocus(tr,false,undefined,window);//instantly: false
        }
        if (solo && tabulator.isExtension) {
            // See https://developer.mozilla.org/en/NsIGlobalHistory2
            // See <http://mxr.mozilla.org/mozilla-central/source/toolkit/
            //     components/places/tests/mochitest/bug_411966/redirect.js#157>
            var ghist2 = Components.classes["@mozilla.org/browser/global-history;2"].
                                    getService(Components.interfaces.nsIGlobalHistory2);
            ghist2.addURI(newURI(subject.uri), false, true, referrer);
/*
            var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                .getService(Components.interfaces.nsINavHistoryService);
            // See http://people.mozilla.com/~dietrich/places/interfacens_i_nav_history_service.html
            // and https://developer.mozilla.org/en/NSPR_API_Reference/Date_and_Time and
            // https://developer.mozilla.org/en/Using_the_Places_history_service
            historyService.addVisit(newURI(subject.uri),
                    undefined, @@
                    undefined, // in nsIURI aReferringUR
                    historyService.TRANSITION_LINK, // = 1
                    false, // True if the given visit redirects to somewhere else. (hides it)
                    0) // @@ Should be the session ID
*/
        }
        return subject;
    }
    
    this.GotoURIAndOpen = function(uri) {
       var sbj = GotoURI(uri);
    }

////////////////////////////////////////////////////////
//
//
//                    VIEWS
//
//
////////////////////////////////////////////////////////

    var views = {
        properties                          : [],
        defaults                                : [],
        classes                                 : []
    }; //views

    /** add a property view function **/
    function views_addPropertyView(property, pviewfunc, isDefault) {
        if (!views.properties[property]) 
            views.properties[property] = [];
        views.properties[property].push(pviewfunc);
        if(isDefault) //will override an existing default!
            views.defaults[property] = pviewfunc;
    } //addPropertyView

    var ns = tabulator.ns;
    //view that applies to items that are objects of certain properties.
    //views_addPropertyView(property, viewjsfile, default?)
    views_addPropertyView(ns.foaf('depiction').uri, VIEWAS_image, true);
    views_addPropertyView(ns.foaf('img').uri, VIEWAS_image, true);
    views_addPropertyView(ns.foaf('thumbnail').uri, VIEWAS_image, true);
    views_addPropertyView(ns.foaf('logo').uri, VIEWAS_image, true);
    //views_addPropertyView(ns.mo('image').uri, VIEWAS_image, true);
    //views_addPropertyView(ns.foaf('aimChatID').uri, VIEWAS_aim_IMme, true);
    views_addPropertyView(ns.foaf('mbox').uri, VIEWAS_mbox, true);
    //views_addPropertyView(ns.foaf('based_near').uri, VIEWAS_map, true);
    //views_addPropertyView(ns.foaf('birthday').uri, VIEWAS_cal, true);

    var thisOutline=this;
    /** some builtin simple views **/

    function VIEWAS_boring_default(obj) {
        //tabulator.log.debug("entered VIEWAS_boring_default...");
        var rep; //representation in html

        if (obj.termType == 'literal')
        {
            var styles = { 'integer': 'text-align: right;',
                    'decimal': 'text-align: ".";',
                    'double' : 'text-align: ".";',
                    };
            rep = myDocument.createElement('span');
            rep.textContent = obj.value;
            // Newlines have effect and overlong lines wrapped automatically
            var style = '';
            if (obj.datatype && obj.datatype.uri) {
                var xsd = tabulator.ns.xsd('').uri;
                if (obj.datatype.uri.slice(0, xsd.length) == xsd)
                    style = styles[obj.datatype.uri.slice(xsd.length)];
            }
            rep.setAttribute('style', style ? style : 'white-space: pre-wrap;');
            
        } else if (obj.termType == 'symbol' || obj.termType == 'bnode') {
            rep = myDocument.createElement('span');
            rep.setAttribute('about', obj.toNT());
            thisOutline.appendAccessIcons(kb, rep, obj);
            
            if (obj.termType == 'symbol') { 
                if (obj.uri.slice(0,4) == 'tel:') {
                    var num = obj.uri.slice(4);
                    var anchor = myDocument.createElement('a');
                    rep.appendChild(myDocument.createTextNode(num));
                    anchor.setAttribute('href', obj.uri);
                    anchor.appendChild(tabulator.Util.AJARImage(tabulator.Icon.src.icon_telephone,
                                                 'phone', 'phone '+num,myDocument))
                    rep.appendChild(anchor);
                    anchor.firstChild.setAttribute('class', 'phoneIcon');
                } else { // not tel:
                    rep.appendChild(myDocument.createTextNode(tabulator.Util.label(obj)));
                }
            } else {  // bnode
                rep.appendChild(myDocument.createTextNode(tabulator.Util.label(obj)));
            }
        } else if (obj.termType=='collection'){
            // obj.elements is an array of the elements in the collection
            rep = myDocument.createElement('table');
            rep.setAttribute('about', obj.toNT());
    /* Not sure which looks best -- with or without. I think without

            var tr = rep.appendChild(document.createElement('tr'));
            tr.appendChild(document.createTextNode(
                    obj.elements.length ? '(' + obj.elements.length+')' : '(none)'));
    */
            for (var i=0; i<obj.elements.length; i++){
                var elt = obj.elements[i];
                var row = rep.appendChild(myDocument.createElement('tr'));
                var numcell = row.appendChild(myDocument.createElement('td'));
                numcell.setAttribute('about', obj.toNT());
                numcell.innerHTML = (i+1) + ')';
                row.appendChild(thisOutline.outline_objectTD(elt));
            }
        } else if (obj.termType=='formula'){
            rep = tabulator.panes.dataContentPane.statementsAsTables(obj.statements, myDocument);
            rep.setAttribute('class', 'nestedFormula')
                        
        } else {
            tabulator.log.error("Object "+obj+" has unknown term type: " + obj.termType);
            rep = myDocument.createTextNode("[unknownTermType:" + obj.termType +"]");
        } //boring defaults.
        tabulator.log.debug("contents: "+rep.innerHTML);
        return rep;
    }  //boring_default
    
    function VIEWAS_image(obj) {
        img = tabulator.Util.AJARImage(obj.uri, tabulator.Util.label(obj), tabulator.Util.label(obj),myDocument);
        img.setAttribute('class', 'outlineImage')
        return img
    }
    
    function VIEWAS_mbox(obj) {
        var anchor = myDocument.createElement('a');
        // previous implementation assumed email address was Literal. fixed.
        
        // FOAF mboxs must NOT be literals -- must be mailto: URIs.
        
        var address = (obj.termType=='symbol') ? obj.uri : obj.value; // this way for now
        if (!address) return VIEWAS_boring_default(obj)
        var index = address.indexOf('mailto:');
        address = (index >= 0) ? address.slice(index + 7) : address;
        anchor.setAttribute('href', 'mailto:'+address);
        anchor.appendChild(myDocument.createTextNode(address));
        return anchor;
    }
    /* need to make unique calendar containers and names
     * YAHOO.namespace(namespace) returns the namespace specified 
     * and creates it if it doesn't exist
     * function 'uni' creates a unique namespace for a calendar and 
     * returns number ending
     * ex: uni('cal') may create namespace YAHOO.cal1 and return 1
     *
     * YAHOO.namespace('foo.bar') makes YAHOO.foo.bar defined as an object,
     * which can then have properties
     */
    function uni(prefix){
        var n = counter();
        var name = prefix + n;
        YAHOO.namespace(name);
        return n;
    }
    // counter for calendar ids, 
    counter = function(){
            var n = 0;
            return function(){
                    n+=1;
                    return n;
            }
    }() // *note* those ending parens! I'm using function scope
    var renderHoliday = function(workingDate, cell) { 
            YAHOO.util.Dom.addClass(cell, "holiday");
    } 
    /* toggles whether element is displayed
     * if elt.getAttribute('display') returns null, 
     * it will be assigned 'block'
     */
    function toggle(eltname){
            var elt = myDocument.getElementById(eltname);
            elt.style.display = (elt.style.display=='none')?'block':'none'
    }
    /* Example of calendar Id: cal1
     * 42 cells in one calendar. from top left counting, each table cell has
     * ID: YAHOO.cal1_cell0 ... YAHOO.cal.1_cell41
     * name: YAHOO.cal1__2006_3_2 for anchor inside calendar cell 
     * of date 3/02/2006
     * 
     */ 
    function VIEWAS_cal(obj) {
        prefix = 'cal';
        var cal = prefix + uni(prefix);

        var containerId = cal + 'Container';
        var table = myDocument.createElement('table');
        
        
        // create link to hide/show calendar
        var a = myDocument.createElement('a');
        // a.appendChild(document.createTextNode('[toggle]'))
        a.innerHTML="<small>mm-dd: " + obj.value + "[toggle]</small>";
        //a.setAttribute('href',":toggle('"+containerId+"')");
        a.onclick = function(){toggle(containerId)};
        table.appendChild(a);

        var dateArray = obj.value.split("-");
        var m = dateArray[0];
        var d = dateArray[1];
        var yr = (dateArray.length>2)?dateArray[2]:(new Date()).getFullYear();

        // hack: calendar will be appended to divCal at first, but will
        // be moved to new location
        myDocument.getElementById('divCal').appendChild(table);
        var div = table.appendChild(myDocument.createElement('DIV'));
        div.setAttribute('id', containerId);
        // default hide calendar
        div.style.display = 'none';
        div.setAttribute('tag','calendar');
        YAHOO[cal] = new YAHOO.widget.Calendar("YAHOO." + cal, containerId, m+"/"+yr);

        YAHOO[cal].addRenderer(m+"/"+d, renderHoliday); 

        YAHOO[cal].render();
        // document.childNodes.removeChild(table);
        return table;
    }
    // test writing something to calendar cell
    function VIEWAS_aim_IMme(obj) {
        var anchor = myDocument.createElement('a');
        anchor.setAttribute('href', "aim:goim?screenname=" + obj.value + "&message=hello");
        anchor.setAttribute('title', "IM me!");
        anchor.appendChild(myDocument.createTextNode(obj.value));
        return anchor;
    } //aim_IMme
    this.createTabURI = function() {
        myDocument.getElementById('UserURI').value=
          myDocument.URL+"?uri="+myDocument.getElementById('UserURI').value;
    }

    var wholeDoc = doc.getElementById('docHTML');
    if (wholeDoc) wholeDoc.addEventListener('keypress',function(e){thisOutline.OutlinerKeypressPanel.apply(thisOutline,[e])},false);
    
    var outlinePart = doc.getElementById('outline');
    if (outlinePart) outlinePart.addEventListener('mousedown',thisOutline.OutlinerMouseclickPanel,false);
    
    //doc.getElementById('outline').addEventListener('keypress',thisOutline.OutlinerKeypressPanel,false);
    //Kenny: I cannot make this work. The target of keypress is always <html>.
    //       I tried doc.getElementById('outline').focus();

    //doc.getElementById('outline').addEventListener('mouseover',thisOutline.UserInput.Mouseover,false);
    //doc.getElementById('outline').addEventListener('mouseout',thisOutline.UserInput.Mouseout,false);

    //a way to expose variables to UserInput without making them propeties/methods
    this.UserInput.setSelected = setSelected;
    this.UserInput.deselectAll = deselectAll;
    this.UserInput.views = views;
    this.outline_expand = outline_expand;
    
    if(tabulator.isExtension) {
        // dump('myDocument.getElementById("tabulator-display") = '+myDocument.getElementById("tabulator-display")+"\n");
        window.addEventListener('unload',function() {
                var tabStatusBar = gBrowser.ownerDocument.getElementById("tabulator-display");
                tabStatusBar.label=="";
                tabStatusBar.setAttribute('style','display:none');           
            },true);
        
        gBrowser.mPanelContainer.addEventListener("select", function() {
                var tabStatusBar = gBrowser.ownerDocument.getElementById("tabulator-display");
                tabStatusBar.label=="";
                tabStatusBar.setAttribute('style','display:none');           
            },true);
    }
    
    // this.panes = panes; // Allow external panes to register
    
    return this;
}//END OF OUTLINE

