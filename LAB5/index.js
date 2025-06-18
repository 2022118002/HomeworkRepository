const express = require("express");
const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");
const path = require("path");
const commentsPath = path.join(__dirname, "comments.json");

const app = express();

async function getDBConnection() {
  return await sqlite.open({
    filename: "product.db",
    driver: sqlite3.Database,
  });
}

function sortMovies(movies, sort) {
  switch (sort) {
    case "vote_asc":
      return movies.sort((a, b) => a.movie_rate - b.movie_rate);
    case "vote_desc":
      return movies.sort((a, b) => b.movie_rate - a.movie_rate);
    case "date_asc":
      return movies.sort(
        (a, b) =>
          new Date(a.movie_release_date) - new Date(b.movie_release_date)
      );
    case "date_desc":
      return movies.sort(
        (a, b) =>
          new Date(b.movie_release_date) - new Date(a.movie_release_date)
      );
    default:
      return movies;
  }
}

app.use(express.static("public"));

// 메인 페이지
app.get("/", async (req, res) => {
  const db = await getDBConnection();
  const keyword = req.query.keyword || "";
  const sort = req.query.sort || "vote_desc";

  const movies = await db.all(`SELECT * FROM movies WHERE movie_title LIKE ?`, [
    `%${keyword}%`,
  ]);
  await db.close();

  const sortedMovies = sortMovies(movies, sort);

  const movieHTML = sortedMovies
    .map(
      (movie) => `
    <a href="/movies/${movie.movie_id}" class="movie-card-link">
      <div class="movie-card">
        <div class="movie-image">
          <img src="${movie.movie_image}" alt="${movie.movie_title}">
          <div class="movie-overlay">
            <p><strong>줄거리:</strong><br>${movie.movie_overview}</p>
          </div>
        </div>
        <div class="movie-info">
          <h3 class="movie-title">${movie.movie_title}</h3>
          <p class="movie-date">📅 ${movie.movie_release_date}</p>
          <p class="movie-rating">⭐ ${movie.movie_rate}</p>
        </div>
      </div>
    </a>
  `
    )
    .join("");

  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>CAS2109 MOVIE SITE</title>
  <link rel="stylesheet" href="/main.css" />
</head>
<body>
  <header>
    <div class="text-wrapper">
      <h1>CAS2109 MOVIE SITE</h1>
    </div>
    <nav>
      <a href="/">Main</a>
      <a href="/login">Log In</a>
      <a href="/signup">Sign Up</a>
    </nav>
  </header>

  <main id="main-container">
    <form id="filter-form" class="search-bar" method="GET" action="/">
      <input type="text" id="search-input" name="keyword" placeholder="키워드를 입력하세요." value="${keyword}" />
      <input type="hidden" id="sort-hidden" name="sort" value="${sort}" />
      <button type="submit">Filter results</button>
    </form>

    <section class="movie-section">
      <aside class="filter-box">
        <h3>정렬 기준</h3>

        <div class="radio-option">
          <label><span class="label-text">평점 내림차순</span>
            <input type="radio" name="sort-radio" value="vote_desc" ${
              sort === "vote_desc" ? "checked" : ""
            } />
          </label>
        </div>
        <div class="radio-option">
          <label><span class="label-text">평점 오름차순</span>
            <input type="radio" name="sort-radio" value="vote_asc" ${
              sort === "vote_asc" ? "checked" : ""
            } />
          </label>
        </div>
        <div class="radio-option">
          <label><span class="label-text">개봉 내림차순</span>
            <input type="radio" name="sort-radio" value="date_desc" ${
              sort === "date_desc" ? "checked" : ""
            } />
          </label>
        </div>
        <div class="radio-option">
          <label><span class="label-text">개봉 오름차순</span>
            <input type="radio" name="sort-radio" value="date_asc" ${
              sort === "date_asc" ? "checked" : ""
            } />
          </label>
        </div>
      </aside>

      <section id="movie-list">
        ${movieHTML}
      </section>
    </section>
  </main>

  <script>
    // 라디오 버튼 클릭 시 hidden 값 업데이트 후 form 제출
    const radios = document.querySelectorAll('input[name="sort-radio"]');
    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        document.getElementById("sort-hidden").value = radio.value;
        document.getElementById("filter-form").submit();
      });
    });
  </script>
</body>
</html>`);
});

// 로그인 페이지
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 회원가입 페이지
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

const fs = require("fs").promises;

// 영화 상세 페이지
app.get("/movies/:movie_id", async (req, res) => {
  const db = await getDBConnection();
  const movieId = req.params.movie_id;

  const movie = await db.get("SELECT * FROM movies WHERE movie_id = ?", [
    movieId,
  ]);
  await db.close();

  if (!movie) {
    return res.status(404).send("<h1>영화를 찾을 수 없습니다.</h1>");
  }

  // 댓글 불러오기
  let comments = [];
  try {
    const data = await fs.readFile(commentsPath, "utf-8");
    const allComments = JSON.parse(data);
    comments = allComments[movieId] || [];
  } catch (err) {
    console.error("댓글 불러오기 실패:", err);
  }

  const commentHTML = comments.map((c) => `<li>${c}</li>`).join("");

  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${movie.movie_title} - 상세 정보</title>
  <link rel="stylesheet" href="/main.css" />
  <style>
    .movie-detail {
      display: flex;
      align-items: flex-start;
      gap: 24px;
      background-color: #fff;
      padding: 24px;
      border-radius: 12px;
      max-width: 900px;
      margin: 40px auto;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    }

    .movie-detail-image {
      width: 200px;
      height: auto;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .movie-detail-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .movie-detail-info h2 {
      margin: 0;
      font-size: 22px;
    }

    .movie-detail-info p {
      margin: 4px 0;
      font-size: 15px;
      line-height: 1.6;
    }

    .movie-detail-info p strong {
      font-weight: bold;
    }

    .movie-meta {
      font-size: 14px;
      color: #555;
    }

    .movie-meta span {
      display: inline-block;
      margin-right: 12px;
    }

    .movie-meta span::before {
      margin-right: 4px;
    }

    .movie-meta .id::before {
      content: "🎬";
    }

    .movie-meta .date::before {
      content: "📅";
    }

    .movie-meta .rate::before {
      content: "⭐";
    }

    .movie-overview::before {
      content: "📖 ";
      font-weight: bold;
    }
  </style>
</head>
<body>
  <header>
    <div class="text-wrapper">
      <h1>CAS2109 MOVIE SITE</h1>
    </div>
    <nav>
      <a href="/">Main</a>
      <a href="/login">Log In</a>
      <a href="/signup">Sign Up</a>
    </nav>
  </header>


  <main id="main-container">
    <div class="movie-detail">
      <img src="${movie.movie_image}" alt="${movie.movie_title}" class="movie-detail-image"/>
      <div class="movie-detail-info">
        <h2>🎞️ ${movie.movie_title}</h2>
        <div class="movie-meta">
          <span class="id">Movie Id: ${movie.movie_id}</span>
          <span class="date">${movie.movie_release_date}</span>
          <span class="rate">${movie.movie_rate}</span>
        </div>
        <p class="movie-overview">${movie.movie_overview}</p>
      </div>
    </div>

    <section class="comment-section">
  <h3 class="comment-title">🗣️ Comments</h3>
  <ul class="comment-list">
    ${commentHTML}
  </ul>

  <form method="POST" action="/movies/${movieId}/comment" class="comment-form">
    <input type="text" name="comment" placeholder="후기를 작성하세요" required class="comment-input" />
    <button type="submit" class="comment-button">등록하기</button>
  </form>
</section>

  </main>
</body>
</html>`);
});

app.use(express.urlencoded({ extended: true }));

app.post("/movies/:movie_id/comment", async (req, res) => {
  const movieId = req.params.movie_id;
  const newComment = req.body.comment;

  try {
    const data = await fs.readFile(commentsPath, "utf-8");
    const allComments = JSON.parse(data);

    if (!allComments[movieId]) {
      allComments[movieId] = [];
    }

    allComments[movieId].push(newComment);

    await fs.writeFile(
      commentsPath,
      JSON.stringify(allComments, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("댓글 저장 실패:", err);
  }

  res.redirect(`/movies/${movieId}`);
});

app.listen(3000, () => {
  console.log("http://localhost:3000");
});
