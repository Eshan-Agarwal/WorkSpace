const $ = require('jquery');
const fs = require('fs');

//requiring the dialog opening element from electron
const dialog = require("electron").remote.dialog;


$(document).ready(function() {
    // console.log('jquery Loaded');
    let lastSelectedCell;
    let db;


    /******************************************* menu-functionality********************/

    let lastCell;
    $("#grid .cell").on("click", function() {

        //get cellId and show its address into address bar
        let {rowId, colId} = getRCid(this);
        let cellAddress = String.fromCharCode(65 + colId) + (rowId + 1);
        $("#address-input").val(cellAddress);

        //get cellDbObj and show its formula into the formula bar
        let cellDbObj = getDbCell(this);
        let formula = cellDbObj.formula;
        $('#formula-input').val(formula);    

        //check if last cell exist, and if it does, check this(present) is not the last cell, THEN remove .selected class from lastCell
        if(lastCell && this != lastCell) {
            $(lastCell).removeClass("selected");
        }

        //add selected class to current cell
        $(this).addClass("selected");


        //if this current selected cell is bold in DB, make the bold button dark, unless make it normal.
        if(cellDbObj.isBold == true) {
            $("#bold").addClass("isOn");
        }
        else {
            $("#bold").removeClass("isOn");
        }

        //if current selected cell is underline in Db, make underline button dark, unless normal
        if(cellDbObj.isUnderline == true) {
            $("#underline").addClass("isOn");
        }
        else {
            $("#underline").removeClass("isOn");
        }
        
        //if current selected cell is italic in Db, make the italic button dark, unless make it normal.
        if(cellDbObj.isItalic == true) {
            $("#italic").addClass("isOn");
        }
        else {
            $("#italic").removeClass("isOn");
        }

        $("#font-size").val(cellDbObj.fontSize);

        $("#font-family").val(cellDbObj.fontFamily);

        $("#bg-color").val(cellDbObj.bgColor);

        $("#text-color").val(cellDbObj.textColor);


        //selecting the allignment button
        let cellAlign = cellDbObj.halign;
        if(cellAlign == "left") {
            $("#lAlign").addClass("isOn");
            $("#cAlign").removeClass("isOn");
            $("#rAlign").removeClass("isOn");
        }
        else if(cellAlign == "center") {
            $("#lAlign").removeClass("isOn");
            $("#cAlign").addClass("isOn");
            $("#rAlign").removeClass("isOn");
        }
        else if(cellAlign == "right") {
            $("#lAlign").removeClass("isOn");
            $("#cAlign").removeClass("isOn");
            $("#rAlign").addClass("isOn");
        }

        //update the lastCell
        lastCell = this;
    })





    /**********************************NEW, SAVE, OPEN********************************** */

    //when click on new
    $("#New").on("click", function() {
        init();
    })

    //when click on save
    $("#Save").on("click", async function() {
        //open file saving dialog box.
        let jsonData = JSON.stringify(db);

        filename = dialog.showSaveDialog({
            filters: [
                { name: 'JSON Files', extensions: ['json'] }
            ],
            properties: ['openFile']
        })
        .then(result => {
            filename = result.filePath;
            if (filename === undefined) {
                console.log('the user clicked the btn but didn\'t created a file');
                return;
            }

            fs.writeFile(filename, jsonData, (err) => {
                if (err) {
                    console.log('an error ocurred with file creation ' + err.message);
                    return
                }
                alert('File Saved');
            })
            
        }).catch(err => {
            alert(err)
        })

    })

    //when click on open
    $("#Open").on("click", async function() {
        //open the dialog box, and get the selected file
        let sdb = await dialog.showOpenDialog({
            filters: [
                { name: 'JSON Files', extensions: ['json'] }
            ],
            properties: ['openFile']
        });
        
        let firstFile = sdb.filePaths[0];

        //if no file is selected, ask to select one.
        if(firstFile == undefined) {
            alert("Please select one file to open it in MY_EXCEL.");
            console.log("firstly select a file to open");
            return;
        }

        //read the file into buffer, and parse it into DB.
        let buffer = fs.readFileSync(firstFile);
        db = JSON.parse(buffer);

        //traverse over all cells on UI, and update there value on UI. 
        let allRows = $("#grid").find(".row");
        for(let i = 0; i < allRows.length; i++) {
            let allCells = $(allRows[i]).find('.cell');
            for(let j = 0; j < allCells.length; j++) {
                //update DbCell value onto the UI
                let cell = db[i][j];
                $(allCells[j]).html(cell.value);
                $(allCells[j]).css("font-weight", cell.isBold ? "bolder" : "normal");
                $(allCells[j]).css("font-style", cell.isItalic ? "italic" : "normal");
                $(allCells[j]).css("text-decoration", cell.isUnderline ? "underline" : "none");
                $(allCells[j]).css("font-family", cell.fontFamily);
                $(allCells[j]).css("font-size", cell.fontSize);
                $(allCells[j]).css("color", cell.textColor);
                $(allCells[j]).css("background-color", cell.bgColor);
                $(allCells[j]).css("text-align", cell.halign);
            }
        }

    })



    //*********************************Formula-stuf**********************/

    //val -> val
    //formula -> val
    $('#grid .cell').on('blur', function() {
        //get this cell id's and DbObj
        let cellId = getRCid(this);
        let cellDbObj = getDbCell(this);
        
        //update our new lcs
        lcs = this;
        
        //if value is not changed, then do noting (just update)
        if(cellDbObj.value == $(this).html()) {
            return;
        }

        //if formula is present, then properly remove formula effect from current cell
        if(cellDbObj.formula) {
            removeFormula(cellDbObj,this);
        }
        
        //get cell value from UI, & update present cell and all downStream cell accordingly (using recursion)
        let nVal = $(this).text();
        updateCells(cellId.rowId, cellId.colId, nVal);
        
    });

    //val -> formula
    //formula -> formula
    $('#formula-input').on('blur', function () {
        //get the cellId and cellDbObj
        let cellId = getRCid(lcs);
        let cellDbObj = getDbCell(lcs);

        //if cell earlier formula is equal to now formula do nothing
        if(cellDbObj.formula == $(this.val)) {
            return;
        }

        //if earlier any formula is present, remove that formula functionality.
        if(cellDbObj.formula) {
            removeFormula(cellDbObj, lcs);
        }

        //update new formula to DB
        cellDbObj.formula = $(this).val();

        //set the new upstream, and the downstream of those elements
        updateUDstream(lcs, cellDbObj.formula);

        //calculate the current cell value
        let cVal = evaluate(cellDbObj);

        //update current cell value in Db & UI, and value of corresponding downstream elements(recursively)
        updateCells(cellId.rowId, cellId.colId, cVal);
    })


    //delete formula and clear the upstream element's functionality
    function removeFormula(cellDb, elementUi) {
        //clear our cell formula
        cellDb.formula = "";
        
        //remove ourself from parent's downstream
        let cellId = getRCid(elementUi);
        for(let i = 0; i < cellDb.upstream.length; i++) {
            let usObj = cellDb.upstream[i];
            let parentDbObj = db[usObj.rowId][usObj.colId];

            let parentDstream = parentDbObj.downstream.filter(function(dCell) {
                return !(dCell.colId == cellId.colId && dCell.rowId == cellId.rowId);
            })
            parentDbObj.downstream = parentDstream;
        }

        //clear our upstream array.
        cellDb.upstream = [];
    }


    //update the current cell value in DB and UI, and do same to downstream elements
    function updateCells(rowId, colId, nVal) {
        //get the DbObj cell, and update its value with nVal
        let cellDbObj = db[rowId][colId];
        cellDbObj.value = nVal;

        //update UI cell value
        $(`#grid .cell[rId=${rowId}][cId=${colId}]`).html(nVal);

        //update all elements in downstream.
        for(let i = 0; i < cellDbObj.downstream.length; i++) {
            //get downstream cellObject in DB, and evaluate it's present value.
            let dCellId = cellDbObj.downstream[i];
            let dCellDbObj = db[dCellId.rowId][dCellId.colId];
            let dValue = evaluate(dCellDbObj);

            //update this cell value, and its downstream cell's too.
            updateCells(dCellId.rowId, dCellId.colId, dValue);

        }
    }


    //evauate the value of cell, using its formula
    function evaluate(cellDbObj) {
        //get formula and print that formula
        let formula = cellDbObj.formula;
        console.log(formula);

        //make array of each element of formula 
        let formulaCompArr = formula.split(" ");

        //update all the fomula components elements, with their actual value.   C1 = [ (, A1, +,B1, ) ]
        for(let i = 0; i < cellDbObj.upstream.length; i++) {
            //get upstream-cellId, upstream-cellDb, and value of upstream-cellDb
            let uCellId = cellDbObj.upstream[i];
            let uCellDbObj = db[uCellId.rowId][uCellId.colId];
            let uCellValue = uCellDbObj.value;

            //get upstream-cell address(name)
            let uColAddress = String.fromCharCode(uCellId.colId + 65);
            let uCellAddress = uColAddress + (uCellId.rowId + 1); 

            //update the formulaComponentArr elements address with respective ucellDb-value
            formulaCompArr = formulaCompArr.map(function(ele) {
                if(ele == uCellAddress) {
                    return uCellValue;
                }
                else {
                    return ele;
                }
            });
        }

        //after updating all upstream values in the formulaCompArr, join it on the basics of space, to make a single formula string
        formula = formulaCompArr.join(" ");             ( 20 + 10 )
        // formula = formula.replace("(","").replace(")","");
        console.log(formula);

        //calculate the final value(Infix-Evaluation), using eval (inbuilt function)
        let currentCellValue = eval(formula);

        return currentCellValue;
    }


    //update yourself to parent-downstream, and set parent to our upstream
    function updateUDstream(cellUi, formula) {        
        //get current cellId
        let {rowId, colId} = getRCid(cellUi)
        
        //get current cellDb
        let cellDb = getDbCell(cellUi);

        //"( A1 + B1 )" -> "A1 + B1"
        formula = formula.replace("(", "").replace(")", "");
        //[A1, +, B1]
        let formulaArr = formula.split(" ");

        for(let i = 0; i < formulaArr.length; i++) {
            let charAt0 = formulaArr[i].charCodeAt(0);
            if(charAt0 >= 65 && charAt0 <= 90) {
                //get parentDb object
                let {r, c} = getrcFComp(formulaArr[i], charAt0);
                let parentDbObj = db[r][c];

                //push yourself into parent's downstream
                parentDbObj.downstream.push( {
                    rowId: rowId,
                    colId: colId
                })

                //push parent to our upstream
                cellDb.upstream.push({
                    rowId: r,
                    colId: c
                })
            }
        }
    }


    //to get rId and CId of parent from formula Component.
    function getrcFComp(cellName, charAt0) {
        let sArr = cellName.split("");
        sArr.shift();
        let sRow = sArr.join("");

        let r = Number(sRow) - 1;
        let c = charAt0 - 65;
        return { r, c};
    }
    


    /************************************************************Init, getRowColId, getDbCell functionality*********************** */

    function init() {
        db = [];
        let allRows = $('#grid').find('.row');
        
        for(let  i = 0; i < allRows.length; i++) {
            let row = [];
            let allCols = $(allRows[i]).find('.cell');
            for(let j = 0; j < allCols.length; j++) {
                //creating DB
                let cell = {
                    value: "",
                    formula: "",
                    upstream: [],
                    downstream: [],

                    isBold: false,
                    isItalic: false,
                    isUnderline: false,
                    fontFamily: "Arial",
                    fontSize: 14,
                    bgColor: "#ffffff",
                    textColor: "#000000",
                    halign: "left"
                };

                $(allCols[j]).html('');                    //it will set the initial properties on all the cell.
                $(allCols[j]).css("font-weight", cell.isBold ? "bolder" : "normal");
                $(allCols[j]).css("font-style", cell.isItalic ? "italic" : "normal");
                $(allCols[j]).css("text-decoration", cell.isUnderline ? "underline" : "none");
                $(allCols[j]).css("font-family", cell.fontFamily);
                $(allCols[j]).css("font-size", cell.fontSize);
                $(allCols[j]).css("color", cell.textColor);
                $(allCols[j]).css("background-color", cell.bgColor);
                $(allCols[j]).css("text-align", cell.halign);
                
                row.push(cell);
            }
            db.push(row);
        }

        //keep the cursor on the first row and first col
        $("#grid .cell").eq(0).trigger("click");
    }
    init();

    
    //get dadabase cell
    function getDbCell(element) {
        let {rowId, colId} = getRCid(element);
        return db[rowId][colId]; 
    }

    //get rowId and colId of UI cell
    function getRCid(element) {
        let rowId = Number($(element).attr('rId'));
        let colId = Number($(element).attr('cId'));
        return {
            rowId: rowId,
            colId: colId
        };
    }


    /*******************************************scroll functioning****************************************************************/

    $('.content-container').on("scroll", function() {
        let scrollY = $(this).scrollTop();
        let scrollX = $(this).scrollLeft();

        $("#top-row, #top-left-cell").css("top", scrollY + "px");
        $("#top-left-cell, #left-col").css("left", scrollX + "px");
    })
    

    /*******************************************Adjust the height of current cell according to it's content **************************************/
    $("#grid .cell").on("keydown", function() {
        let {rowId} = getRCid(this);
        let ht = $(this).height();

        $($("#left-col .cell")[rowId]).height(ht);
    })

        

    /***************************************styling functionality***********************/

    //when bold button is clicked.
    $("#bold").on("click", function() {
        //toggle the on|off class
        $(this).toggleClass("isOn");

        //if button is made bold now, and change property of .selected cell accordingly.
        let isOn = $(this).hasClass("isOn");

        let cellEle = $("#grid .cell.selected");
        cellEle.css("font-weight", isOn? "bolder" : "normal");

        //update the bold property change in db
        let cellDbObj = getDbCell(cellEle);
        cellDbObj.isBold = isOn;
    })

    //when underline button is clicked
    $("#underline").on("click", function() {
        //toggle the on|off class from the button css;
        $(this).toggleClass("isOn");

        //check if button is made underline now, then make respective changes
        let isOn = $(this).hasClass("isOn");

        let cellEle = $("#grid .cell.selected");
        cellEle.css("text-decoration", isOn? "underline" : "none");

        //update the underline property in Db
        let cellDBObj = getDbCell(cellEle);
        cellDBObj.isUnderline = isOn;
    })

    
    //when italic button is clicked
    $("#italic").on("click", function() {
        //toggle the on|off class;
        $(this).toggleClass("isOn");

        //check if button is made ittalic now, and do required changes
        let isOn = $(this).hasClass("isOn");

        let cellEle = $("#grid .cell.selected");
        cellEle.css("font-style", isOn? "italic":"normal");

        //update the italic property in Db
        let cellDBObj = getDbCell(cellEle);
        cellDBObj.isItalic = isOn;        
    })

    //when font-size is changed
    $("#font-size").on("change",function() {
        let fontSize = $(this).val();

        //change the fontsize on UI
        let cellElem = $("#grid .cell.selected");
        cellElem.css({"font-size": fontSize + "px"});

        //changing the DB cell
        let cellDBObj = getDbCell(cellElem);
        cellDBObj.fontSize = fontSize;
    })

    //when font family is changed
    $("#font-family").on("change", function () {
        let fontType = $(this).val();

        //change the respective font-family on UI.
        let cellElem = $("#grid .cell.selected");
        cellElem.css("font-family", fontType);
        
        //change the fontFamily Value on Db cell object.
        let cellDBObj = getDbCell(cellElem);
        cellDBObj.fontFamily = fontType;
    })

    //when bg-color is changed
    $("#bg-color").on("change", function() {
        let bgColor = $(this).val();

        //change the respective cell bgColor on UI
        let cellElem = $("#grid .cell.selected");
        cellElem.css("background-color", bgColor);
        
        //change it in the cell DB.
        let cellDbObj = getDbCell(cellElem);
        cellDbObj.bgColor = bgColor;
    })

    //when text-color is changed
    $("#text-color").on("change", function(){
        let textColor = $(this).val();

        //change the text-color of cell on UI
        let cellElem = $("#grid .cell.selected");
        cellElem.css("color", textColor);

        //change the text color of cell in DB
        let cellDbObj = getDbCell(cellElem);
        cellDbObj.textColor = textColor;
    })
    
    //when leftButton is clicked
    $("#lAlign").on("click", function() {
        let doNothing = $(this).hasClass("isOn");
        
        if(doNothing == false) {
            //change on UI button.
            $(this).addClass("isOn");
            $("#cAlign").removeClass("isOn");
            $("#rAlign").removeClass("isOn");

            //change on UI cell
            let cellElem = $("#grid .cell.selected");
            cellElem.css("text-align", "left");

            //change in Db cell
            let cellDbObj = getDbCell(cellElem);
            cellDbObj.halign = "left";
  
        }
    })

    //when centerButton is clicked
    $("#cAlign").on("click", function() {
        let doNothing = $(this).hasClass("isOn");
        
        if(doNothing == false) {
            //change on button UI
            $("#lAlign").removeClass("isOn");
            $(this).addClass("isOn");
            $("rAlign").removeClass("isOn");

            //change on UI cell
            let cellElem = $("#grid .cell.selected");
            cellElem.css("text-align", "center");

            //change in Db cell
            let cellDbObj = getDbCell(cellElem);
            cellDbObj.halign = "center";

        }
    })

    //when rightButton is clicked
    $("#rAlign").on("click", function() {
        let doNothing = $(this).hasClass("isOn");
        
        if(doNothing == false) {
            //change on button UI
            $("#lAlign").removeClass("isOn");
            $("#cAlign").removeClass("isOn");
            $(this).addClass("isOn");

            //change on UI cell
            let cellElem = $("#grid .cell.selected");
            cellElem.css("text-align", "right");

            //change in Db cell
            let cellDbObj = getDbCell(cellElem);
            cellDbObj.halign = "right";
  
        }
    })


})

