REKAPINYU ADMIN BACKEND

Flow:
Firebase Authentication -> akun admin -> Firestore -> rekapinyu_users -> rekapinyu_data -> Admin UI.

Aplikasi ini membaca data Firestore yang digunakan file basis terakhir dan tidak membaca localStorage pengguna.

Penting: akses admin HARUS ditegakkan oleh Firestore Security Rules/custom claims. Login email saja bukan pengganti authorization.

Cara pakai: upload folder ini ke hosting HTTPS (GitHub Pages/Firebase Hosting) lalu buka index.html melalui hosting. Jangan membuka file:// jika browser memblokir module Firebase.
