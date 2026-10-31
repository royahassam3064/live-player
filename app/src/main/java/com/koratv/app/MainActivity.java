package com.koratv.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.view.Gravity;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.graphics.drawable.GradientDrawable;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;
import org.json.JSONArray;

import java.io.File;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    private WebView webView;
    private FrameLayout fullscreenLayout;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;

    private int previousOrientation;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private static final String RELEASE_URL =
            "https://api.github.com/repos/royahassam3064/live-player/releases/latest";

    private static final String APK_NAME = "kora-tv.apk";

    private String downloadUrl;
    private String latestVersion;

    private ProgressDialog progressDialog;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public void onShowCustomView(
                    View view,
                    CustomViewCallback callback) {

                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }

                customView = view;
                customCallback = callback;

                previousOrientation = getRequestedOrientation();

                setRequestedOrientation(
                        ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                );

                getWindow().addFlags(
                        WindowManager.LayoutParams.FLAG_FULLSCREEN
                );

                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );

                fullscreenLayout = new FrameLayout(MainActivity.this);
                fullscreenLayout.setBackgroundColor(0xFF000000);

                FrameLayout.LayoutParams videoParams =
                        new FrameLayout.LayoutParams(
                                FrameLayout.LayoutParams.MATCH_PARENT,
                                FrameLayout.LayoutParams.MATCH_PARENT
                        );

                fullscreenLayout.addView(view, videoParams);

                ImageView logo = new ImageView(MainActivity.this);
                logo.setImageResource(R.drawable.kora_logo);
                logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
                logo.setPadding(8, 8, 8, 8);

                GradientDrawable background = new GradientDrawable();
                background.setColor(0xCC000000);
                background.setCornerRadius(dp(12));
                background.setStroke(1, 0x33FFFFFF);

                logo.setBackground(background);
                logo.setElevation(dp(10));

                FrameLayout.LayoutParams logoParams =
                        new FrameLayout.LayoutParams(
                                dp(85),
                                dp(85),
                                Gravity.TOP | Gravity.LEFT
                        );

                logoParams.setMargins(dp(16), dp(16), 0, 0);

                fullscreenLayout.addView(logo, logoParams);
                logo.bringToFront();

                setContentView(fullscreenLayout);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });

        setContentView(webView);

        webView.loadUrl(
                "https://royahassam3064.github.io/live-player/"
        );

        checkForUpdates();
    }

    private void checkForUpdates() {

        new Thread(() -> {

            HttpURLConnection connection = null;

            try {
                URL url = new URL(RELEASE_URL);
                connection = (HttpURLConnection) url.openConnection();

                connection.setRequestMethod("GET");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty(
                        "Accept", "application/vnd.github+json"
                );
                connection.setRequestProperty(
                        "User-Agent", "Kora-TV-Android"
                );

                InputStream input = connection.getInputStream();
                StringBuilder result = new StringBuilder();

                byte[] buffer = new byte[4096];
                int count;

                while ((count = input.read(buffer)) != -1) {
                    result.append(new String(buffer, 0, count, "UTF-8"));
                }

                input.close();

                JSONObject release = new JSONObject(result.toString());

                String tag = release.getString("tag_name");
                latestVersion = tag.replaceFirst("^[vV]", "");

                JSONArray assets = release.getJSONArray("assets");

                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.getJSONObject(i);

                    if (APK_NAME.equals(asset.getString("name"))) {
                        downloadUrl = asset.getString("browser_download_url");
                        break;
                    }
                }

                String currentVersion = getCurrentVersion();

                if (downloadUrl != null &&
                        isNewerVersion(latestVersion, currentVersion)) {

                    handler.post(() -> showUpdateDialog());

                }

            } catch (Exception e) {
                e.printStackTrace();

            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }

        }).start();
    }

    private String getCurrentVersion() {

        try {
            PackageInfo info = getPackageManager()
                    .getPackageInfo(getPackageName(), 0);

            return info.versionName;

        } catch (Exception e) {
            return "1.0";
        }
    }

    private boolean isNewerVersion(String latest, String current) {

        try {
            String[] latestParts = latest.split("\\.");
            String[] currentParts = current.split("\\.");

            int length = Math.max(
                    latestParts.length,
                    currentParts.length
            );

            for (int i = 0; i < length; i++) {

                int latestNumber = i < latestParts.length
                        ? Integer.parseInt(latestParts[i]) : 0;

                int currentNumber = i < currentParts.length
                        ? Integer.parseInt(currentParts[i]) : 0;

                if (latestNumber > currentNumber) return true;
                if (latestNumber < currentNumber) return false;
            }

        } catch (Exception e) {
            return false;
        }

        return false;
    }

    private void showUpdateDialog() {

        if (isFinishing()) return;

        new AlertDialog.Builder(this)
                .setTitle("🚀 تحديث جديد متوفر!")
                .setMessage(
                        "يتوفر إصدار جديد من Kora TV.\n\n" +
                        "الإصدار الحالي: " + getCurrentVersion() +
                        "\nالإصدار الجديد: " + latestVersion +
                        "\n\nحمّل التحديث الآن للاستمتاع بالتحسينات الجديدة."
                )
                .setPositiveButton("تنزيل التحديث", (dialog, which) -> {
                    downloadUpdate();
                })
                .setNegativeButton("لاحقاً", null)
                .setCancelable(true)
                .show();
    }

    private void downloadUpdate() {

        if (downloadUrl == null) {
            Toast.makeText(this,
                    "رابط التحديث غير متوفر",
                    Toast.LENGTH_LONG).show();
            return;
        }

        progressDialog = new ProgressDialog(this);
        progressDialog.setTitle("تحديث Kora TV");
        progressDialog.setMessage("جارٍ تنزيل التحديث...");
        progressDialog.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
        progressDialog.setMax(100);
        progressDialog.setProgress(0);
        progressDialog.setCancelable(false);
        progressDialog.show();

        new Thread(() -> {

            HttpURLConnection connection = null;

            try {
                URL url = new URL(downloadUrl);
                connection = (HttpURLConnection) url.openConnection();

                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setRequestProperty(
                        "User-Agent", "Kora-TV-Android"
                );

                int responseCode = connection.getResponseCode();

                if (responseCode != 200) {
                    throw new Exception("فشل تنزيل ملف التحديث");
                }

                int fileLength = connection.getContentLength();

                File directory = getExternalFilesDir(
                        Environment.DIRECTORY_DOWNLOADS
                );

                if (directory == null) {
                    throw new Exception("مساحة التخزين غير متاحة");
                }

                if (!directory.exists()) {
                    directory.mkdirs();
                }

                File apkFile = new File(directory, APK_NAME);

                InputStream input = connection.getInputStream();

                FileOutputStream output = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                int count;
                long total = 0;

                while ((count = input.read(buffer)) != -1) {

                    output.write(buffer, 0, count);
                    total += count;

                    if (fileLength > 0) {
                        int progress = (int) (total * 100 / fileLength);

                        handler.post(() -> {
                            if (progressDialog != null) {
                                progressDialog.setProgress(progress);
                            }
                        });
                    }
                }

                output.flush();
                output.close();
                input.close();

                handler.post(() -> {
                    if (progressDialog != null) {
                        progressDialog.dismiss();
                        progressDialog = null;
                    }

                    installUpdate(apkFile);
                });

            } catch (Exception e) {

                handler.post(() -> {

                    if (progressDialog != null) {
                        progressDialog.dismiss();
                        progressDialog = null;
                    }

                    Toast.makeText(
                            MainActivity.this,
                            "فشل التنزيل: " + e.getMessage(),
                            Toast.LENGTH_LONG
                    ).show();
                });

            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }

        }).start();
    }

    private void installUpdate(File apkFile) {

        try {

            if (!getPackageManager().canRequestPackageInstalls()) {

                new AlertDialog.Builder(this)
                        .setTitle("السماح بالتثبيت")
                        .setMessage(
                                "اسمح للتطبيق بتثبيت التحديثات من هذا المصدر."
                        )
                        .setPositiveButton("فتح الإعدادات", (d, w) -> {

                            Intent intent = new Intent(
                                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + getPackageName())
                            );

                            startActivity(intent);
                        })
                        .setNegativeButton("إلغاء", null)
                        .show();

                return;
            }

            Uri apkUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".provider",
                    apkFile
            );

            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(apkUri);
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            startActivity(intent);

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "تعذر فتح التثبيت: " + e.getMessage(),
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private int dp(int value) {
        return (int) (value * getResources()
                .getDisplayMetrics().density + 0.5f);
    }

    private void exitFullscreen() {

        if (customView == null) {
            return;
        }

        customView = null;

        getWindow().clearFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_VISIBLE
        );

        setContentView(webView);

        setRequestedOrientation(previousOrientation);

        if (customCallback != null) {
            customCallback.onCustomViewHidden();
            customCallback = null;
        }

        fullscreenLayout = null;
    }

    @Override
    public void onBackPressed() {

        if (customView != null) {
            exitFullscreen();

        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();

        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {

        if (progressDialog != null) {
            progressDialog.dismiss();
            progressDialog = null;
        }

        if (webView != null) {
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
