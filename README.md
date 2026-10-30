# Gold Leaf Harvest

Tuesday grow board for **Gold Leaf Harvest** (Morrisville, NC).

This app helps you **plant**, **track each tray**, and **harvest on Tuesday** so you can **deliver to the restaurant that same day**. It does not store prices, costs, invoices, or payments.

## Tuesday production

| Crop | Variety | Days to harvest | Plant day rule |
| --- | --- | --- | --- |
| Nasturtium | Empress of India | 18 | Bigger leaves. Never plant on Tuesday. |
| Amaranth | Red Garnet | 14 | 14 days is a Tuesday, so plant Monday. |
| Cilantro | Coriander | 25 | Slow crop. Never plant on Tuesday. |

The board tells you the next **plant-by date** so harvest and delivery stay on Tuesday. If the count would land on a Tuesday, planting moves to **Monday**.

You can still **add a tray after the fact**. The Add tray dialog includes past Tuesdays and an editable plant date, so a missed plant window or a missed harvest window can be logged.

## Dashboard

The home screen is a **Dashboard** for the grow room: days until harvest Tuesday, tray counts, today’s plant/cut jobs, missed windows, and the next on-time plant dates. It does not show money.

## Phone and iPad

The board is a website. Open it in Safari or Chrome on a phone or iPad. On iPhone, use **Share → Add to Home Screen** so it opens like an app. Buttons are large enough to tap with dirty hands, and the layout stacks on a phone and uses two columns on an iPad.

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
