/*Preference and Configuration

  Q: What is this?
  A: This is where I store optional codes and make them into preferences.
  Q: How do I use it?
  A: Here is how I use it. 
     Step 1: Wrap your code into a function with necesssary arguments.
     Step 2: OptionCollection.addOption(name,function)
     Step 3: Call this piece of code by OptionCollection[name].setupHere(arguments,location)
             where "arguments" is an array of arguments (corresponding to arguments of Step 1)
                   "location" is extra information about where the option is set up.
                   
     Remarks: If there is more than one piece corresponding to an option, use 
              Option.addMoreCode(function) and access pieces of codes by using 
              OptionCollection[name][index].setupHere instead
    
     Step 4: Remember to enable the option (default enabled=false) if you want to test it
  Q: Future?
  A: It should be easy to extend this architecture to contain "hooks", that is you should be able to
     insert code into certain location defined by Step 3.
                                                                2007-06-15 kennyluck
             
*/ 


function Option(code){ //{class Option}
    this.code=code;
    this.length=1;
    this.enabled=false;
    this.setupHere=
    function (arg,message,defaultCode){
        //which is faster? eval or Function?

        this.message=message;//you should input message
        this.defaultCode=defaultCode;        
        //eval:
        //for (var i=0;i<arguments.length;i+=2) eval("var "+arguments[i]+"="+arguments[i+1].toString());
        //if (this.enabled) eval(this.code);
        
        //Function:        
        //if (this.enabled) Function("e",this.code).apply(this,arguments); 
        
        //Neither: (why didn't I find this solution in the past few hours...)
        if (this.enabled) 
            return this.code.apply(this,arg);
        else if (defaultCode)
            return this.defaultCode.apply(this,arg);
    };
    this.addMoreCode=function (func){
        if (this.length==1) this[0]=new Option(this.code);
        this[this.length]=new Option(func);
        this.length++;
    }
    this.enable=function(){
        this.enabled=true;
        if (this.length>1)
            for(var i=0;i<this.length;i++)
                this[i].enabled=true;
    }
}

function OptionCollection(){ //{class OptionCollection}
    this.addOption=
    function(description,code){
        this[description]=new Option(code);
    };
}

/* Utility */

//Magic number 13 only works for functions with no arguments!!
function getFunctionBody(func){
    return func.toSource().substring(func.name.length+13,func.toSource().length-1)
}

/** 
  * Human Computer Interaction Options
  **/
var HCIoptions=new OptionCollection();

//right click to switch mode
function temp_RCTSM0(){
    //temporary key ctrl+s or q for swiching mode
    window.addEventListener('keypress',function(e){	if (e.ctrlKey && (e.charCode==115 || e.charCode==113)) UserInput.switchMode();},false);
    window.addEventListener('mousedown',UserInput.Mousedown,false);
    document.getElementById('outline').oncontextmenu=function(){return false;};
}
HCIoptions.addOption("right click to switch mode",temp_RCTSM0);
delete temp_RCTSM0;

function temp_RCTSM1(e){
    if (e.button==2){ //right click
        UserInput.switchMode();
        if(e){
            e.preventDefault();
            e.stopPropagation();
        }
    }
}
HCIoptions["right click to switch mode"].addMoreCode(temp_RCTSM1);
delete temp_RCTSM1;

function temp_RCTSM2(){
    function thoseRadios(){
        var menuDiv=document.getElementById('MenuBar');
        var labelWrite=document.createElement('label');
        labelWrite.innerHTML='<input type="radio" onclick="UserInput.switchModeByRadio()" name="mode" value="1"><img src="icons/pencil_small.png" title="Edit Mode" /></input>'
        var labelBrowse=document.createElement('label');
        labelBrowse.innerHTML='<input type="radio" onclick="UserInput.switchModeByRadio()" name="mode" value="0" checked><img src="icons/discovery_small.png" title="Discovery Mode" /></input>'
        menuDiv.insertBefore(labelWrite,menuDiv.childNodes[6]); //6!! text nodes suck!
        menuDiv.insertBefore(labelBrowse,menuDiv.childNodes[6]);
    }
    addLoadEvent(thoseRadios);
    addLoadEvent(function(){ document.getElementsByName("mode")[0].checked=true;});
}
HCIoptions["right click to switch mode"].addMoreCode(temp_RCTSM2);
delete temp_RCTSM2;

//able to edit in Discovery Mode by mouse
function temp_ATEIDMBM0(sel,e,outline){
    if (sel) outline.UserInput.Click(e);
}
HCIoptions.addOption("able to edit in Discovery Mode by mouse",temp_ATEIDMBM0);
delete temp_ATEIDMBM0;

function temp_ATEIDMBM1(node,termWidget){
    termWidget.addIcon(node,Icon.termWidgets.addTri);
}
HCIoptions["able to edit in Discovery Mode by mouse"].addMoreCode(temp_ATEIDMBM1);
delete temp_ATEIDMBM1;

function temp_ATEIDMBM2(node){
    termWidget.removeIcon(node,Icon.termWidgets.addTri);
}
HCIoptions["able to edit in Discovery Mode by mouse"].addMoreCode(temp_ATEIDMBM2);
delete temp_ATEIDMBM2;

//favorite dock
function temp_FD0(){
    include("js/calView/yahoo-dom-event.js");
    include("js/calView/dragdrop.js");
}

HCIoptions.addOption("favorite dock",temp_FD0);
delete temp_FD0;


/** 
  * Source Options
  **/
var SourceOptions=new OptionCollection();

//javascript2rdf
function javascript2rdf0()
{
    include("js/misc/javascript2rdf.js");
}
SourceOptions.addOption("javascript2rdf",javascript2rdf0);
delete javascript2rdf0;

function javascript2rdf1(returnConditions)
{
    function javascript2rdfLoad(subject){
        if (subject.termType!='symbol') return false;
        if (string_startswith(subject.uri,"javascript:")){ 
            if(RDFizers["javascript2rdf"].load(subject.uri)) return [true,true];
            return [true,false];
        }
        return false;
    }
    returnConditions.push(javascript2rdfLoad);
}
SourceOptions["javascript2rdf"].addMoreCode(javascript2rdf1);
delete javascript2rdf1;

function javascript2rdf2(URITitlesToStop)
{
    if(URITitlesToStop.length==0) URITitlesToStop.push("javascript:");
}
SourceOptions["javascript2rdf"].addMoreCode(javascript2rdf2);
delete javascript2rdf2;

//tabulator internal terms
function temp_TIT(returnConditions)
{
    function tabulatorTermPanel(subject){
        if (subject.termType!='symbol') return false;
        if (string_startswith(subject.uri,"tabulator:")) return true;
        return false;
    }
}
SourceOptions.addOption("tabulator internal terms",temp_TIT);
delete temp_TIT;
/**
  * Display Options
  **/
var DisplayOptions=new OptionCollection();

//outliner rotate left
function temp_ORL(table,subject){
    var lastTr=table.lastChild;
    if (lastTr)
        return lastTr.appendChild(outline.outline_objectTD(subject,undefined,true));
}
DisplayOptions.addOption("outliner rotate left",temp_ORL);
delete temp_ORL;

//No display:block
function temp_NDP(tr,j,k,dups,td_p,plist,sel,inverse,parent,myDocument,thisOutline){
var s;
var defaultpropview;
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
        for(l=1;l<k;l++){
	if (!sel(plist[j+l]).sameTerm(sel(plist[j+l-1]))){
	    s=plist[j+l];
	    defaultpropview = views.defaults[s.predicate.uri];
            var trObj=myDocument.createElement('tr');
            trObj.style.colspan='1';
            trObj.appendChild(thisOutline.outline_objectTD(sel(plist[j+l]),defaultpropview));
            trObj.AJAR_statement=s;
            trObj.AJAR_inverse=inverse;
            parent.appendChild(trObj);
            if (l>=show){
	        trObj.style.display='none';
                showLaterArray.push(trObj);
	    }
	}
	}
    }

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
                    small.appendChild(AJARImage(Icon.src.icon_more, 'more', 'See all'));
	            small.appendChild( myDocument.createTextNode((predDups-n) + ' more...'));
                    td_p.setAttribute('rowspan',n+1);
                } else{
	            small.appendChild(AJARImage(Icon.src.icon_shrink, '(less)'));
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
    }
}//tr.showNobj

}
DisplayOptions.addOption("No display:block",temp_NDP);
delete temp_NDP;

/**
  * Preferences
  **/
//HCIoptions["right click to switch mode"].enable();
HCIoptions["able to edit in Discovery Mode by mouse"].enable();
//HCIoptions["favorite dock"].enabled=true;

//##Enable this to play with javascript:variableName
//'javascript:document' is not working fine but 'javascript:document.firstChild' is OK
SourceOptions["javascript2rdf"].enable();
SourceOptions["tabulator internal terms"].enable();

//DisplayOptions["outliner rotate left"].enable();
//DisplayOptions["No display:block"].enable();

//ToDo:
//0.Able to query OptionCollections
//1.SourceOptions, ShowingOptions
//2.Someone's preference, option dependency


/* Instances Approach
function HCIoption(){ //{class HCIoption} HCI:Human Computer Interaction
    //register "is rdf:type of"
    this.constructor.instances.push();
}
HCIoption.instances=[];
*/


HCIoptions["right click to switch mode"][2].setupHere([],"end of configuration.js");
SourceOptions["javascript2rdf"][0].setupHere([],"end of configuration.js");
///////////////////////////////////end of configurauration.js



