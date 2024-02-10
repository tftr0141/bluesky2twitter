function addDataRow(data) {
  const sheetData = getMySheet();

  const lastColumn = sheetData[0].length;
  const lastRowIndex = sheetData.length - 1;
  const firstEmptyRowIndex = findFirstEmptyCellInColumn(sheetData);

  const emptyRow = [];
  for (let i = 0; i < lastColumn; i++) {
    emptyRow.push("");
  }

  if (firstEmptyRowIndex === lastRowIndex + 1) {
    sheetData.push(data);
    sheetData.push(emptyRow);
  } else if (firstEmptyRowIndex === lastRowIndex) {
    sheetData[firstEmptyRowIndex] = data;
    sheetData.push(emptyRow);
  } else {
    sheetData[firstEmptyRowIndex] = data;
    sheetData[firstEmptyRowIndex + 1] = emptyRow;
  }

  const maxDataNum = MAX_DATA_NUM;
  if (firstEmptyRowIndex > maxDataNum - 2) {
    sheetData[1] = emptyRow;
  }

  return updateMySheet(
    sheetData,
    `A1:${alphabets[lastColumn - 1]}${sheetData.length}`
  );
}

function findFirstEmptyCellInColumn(_sheetData) {
  const sheetData = _sheetData;
  const lastRow = sheetData[0].length;
  const colValue = sheetData.map((elm) => elm[0]);
  const colLength = colValue.length;
  // Logger.log("colValue:" + colValue);

  for (let i = 0; i < colLength; i++) {
    if (colValue[i] == "") {
      return i;
    }
  }

  return colLength;
}

async function getMySheet(_ranges = SHEET_NAME) {
  // all range for default
  let response = {};
  try {
    // Run both functions at the same time, if the timeout finishes first, stop our API call.
    let timedOut = false;
    response = await Promise.race([
      Sheets.Spreadsheets.Values.batchGet(
        SHEET_ID,
        { ranges: _ranges } // 取得したい範囲  e.g. ['シート1!A:B', 'シート2!C1']
      ),
      createTimeoutPromise(10000).catch((err) => {
        timedOut = true;
      }),
    ]);

    if (timedOut) {
      // This will stop your function if it has taken too long
      throw new Error("Google sheet api call timed out");
    }

    const sheetData = response.valueRanges[0].values || [[]]; // 値の取り出し
    return paddingArray(sheetData, "");
  } catch (e) {
    // range error or timeout
    throw new Error(
      "Getting sheet failed. error: \n" +
        e.message +
        "\n responce: \n" +
        response.getContentText()
    );
  }
}

function updateMySheet(_values, _range) {
  const resource = {
    data: [
      {
        values: paddingArray(_values, ""), //二次元配列で値を入れる
        range: `${SHEET_NAME}!${_range}`, //出力セルを入れる. use A1 notation for range
      },
    ],
    valueInputOption: "USER_ENTERED",
  };

  let result = "";
  try {
    result = Sheets.Spreadsheets.Values.batchUpdate(resource, SHEET_ID);
    // Utilities.sleep(100);
  } catch (e) {
    console.error("updateSheet failed: " + e.message);
    result = e.message;
  }
  return result;
}

function sheetTest() {
  //Logger.log('my sheet: %s \n data: %s', getMySheet(), sheetData[5]);
  let newRow = [
    "bafyreichkne745mkabo74avg3it3jf3voc4wtfzn3tln6knwmpx2c2qezq",
    "test text",
    "FALSE",
    "FALSE",
    "FALSE",
    "TRUE",
  ];
  addDataRow(newRow);
}
