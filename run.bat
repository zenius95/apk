@echo off
echo "Dang bat dau tao cau truc du an cho Bro... 🚀"
echo "------------------------------------------------"

:: Tao cac file goc
echo "Tao cac file goc: server.js, .env, .gitignore"
type nul > server.js
type nul > .env
type nul > .gitignore

:: Tao cac thu muc chinh
echo "Tao thu muc: config, middleware, models, controllers, routes, services"
mkdir config
mkdir middleware
mkdir models
mkdir controllers
mkdir routes
mkdir services

:: Tao thu muc views long nhau
echo "Tao thu muc: views, views\layouts, views\pages"
mkdir views
mkdir views\layouts
mkdir views\pages

:: Tao thu muc public long nhau
echo "Tao thu muc: public, public\js, public\css"
mkdir public
mkdir public\js
mkdir public\css

:: Tao cac file config va model
echo "Tao file config va models..."
type nul > config\database.js
type nul > config\config.json
type nul > models\app.js

:: Tao cac file middleware
echo "Tao file middleware..."
type nul > middleware\auth.js

:: Tao cac file controller
echo "Tao file controllers..."
type nul > controllers\scrapeController.js
type nul > controllers\adminController.js

:: Tao cac file route
echo "Tao file routes..."
type nul > routes\adminRoutes.js
type nul > routes\apiRoutes.js

:: Tao file service
echo "Tao file services..."
type nul > services\scraperService.js

:: Tao file views (ejs)
echo "Tao file views..."
type nul > views\layouts\main.ejs
type nul > views\pages\scrape.ejs

:: Tao file JS/CSS public
echo "Tao file public..."
type nul > public\js\main.js

echo "------------------------------------------------"
echo "✅ HOAN TAT! Cau truc file da duoc tao xong."
echo "Buoc tiep theo: Bro chay 'npm init -y' trong thu muc nay."
echo "Chay xong thi bao toi gui noi dung file 'package.json' nhe."
echo.
pause