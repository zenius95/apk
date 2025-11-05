/**
 * Controller nay chi de render (hien thi) cac trang admin
 */

// Hien thi trang Scrape chinh
const renderScrapePage = (req, res) => {
  try {
    // Render file views/pages/scrape.ejs
    // Truyen vao 1 object 'data' de set title cho trang
    res.render('pages/scrape', {
      data: {
        title: 'Bảng điều khiển - Lấy dữ liệu App'
      },
      // 'layout' la file 'views/layouts/main.ejs'
      // EJS se tu dong nhung 'scrape.ejs' vao 'main.ejs'
      layout: 'layouts/main' 
    });
  } catch (err) {
    console.error("Loi render trang scrape:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

module.exports = {
  renderScrapePage
};