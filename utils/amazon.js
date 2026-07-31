async function checkDogPage(page) {
  return await page.evaluate(() => {
    return (
      document.title.includes("Sorry! Something went wrong") ||
      document.title.includes("Robot Check") ||
      document.body.innerText.includes("something went wrong on our end") ||
      document.body.innerText.includes("Enter the characters you see below") ||
      document.querySelector('form[action="/errors/validateCaptcha"]') !== null
    );
  });
}

function cleanAndCheckMRP(priceStr, mrpStr) {
  if (priceStr === "N/A" || mrpStr === "N/A" || !priceStr || !mrpStr)
    return mrpStr;
  const pNum = parseFloat(priceStr.replace(/[^\d.]/g, ""));
  const mNum = parseFloat(mrpStr.replace(/[^\d.]/g, ""));
  if (!isNaN(pNum) && !isNaN(mNum)) {
    if (mNum <= pNum) return "N/A";
  }
  return mrpStr;
}

module.exports = { checkDogPage, cleanAndCheckMRP };
