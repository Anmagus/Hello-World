# Gold Leaf Harvest

Tuesday grow board for **Gold Leaf Harvest** (Morrisville, NC).

This app helps you **plant**, **track each tray**, and **harvest on Tuesday** so you can **deliver to the restaurant that same day**. It does not store prices, costs, invoices, or payments.

## Tuesday production

| Crop | Variety | Days to harvest | Why that length |
| --- | --- | --- | --- |
| Nasturtium | Empress of India | 16 | A little bigger than a standard cut |
| Amaranth | Red Garnet | 10 | Restaurant rotation |
| Cilantro | Coriander | 17 | Slower crop |

The board tells you the next **plant-by date** so harvest lands on a Tuesday.

## Testing tab

Use **Testing** for other greens you are trying for later distribution. Those trays are not locked to Tuesday.

## Run it locally

From this folder:

```bash
python3 -m http.server 8080
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

Without Firebase configured, trays stay **on that browser only**. Use **Export** / **Import** to move a backup between devices.

## Share the live board with Rebecca (Google sign-in)

1. Create a free [Firebase](https://console.firebase.google.com/) project.
2. Add a **Web** app and copy the firebaseConfig object.
3. Paste it into `js/firebase-config.js` (replace `null`).
4. Enable **Authentication → Google**.
5. Create a **Firestore** database (production mode is fine if you upload `firestore.rules`).
6. Add your GitHub Pages domain and `localhost` under Authentication → Settings → Authorized domains.

After both of you sign in with Google, you see the same trays.

## GitHub Pages

Repo Settings → Pages → Deploy from branch → `master` (root). Then open `https://anmagus.github.io/Hello-World/`.
