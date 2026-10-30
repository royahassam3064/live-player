package com.koratv.app;

import android.app.Activity;
import android.os.Bundle;
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

public class MainActivity extends Activity {

    private WebView webView;
    private FrameLayout fullscreenLayout;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;

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

                // شعار Kora TV
                ImageView logo = new ImageView(MainActivity.this);
                logo.setImageResource(R.drawable.kora_icon);
                logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
                logo.setPadding(8, 8, 8, 8);

                GradientDrawable background = new GradientDrawable();
                background.setColor(0xCC000000);
                background.setCornerRadius(12);
                background.setStroke(1, 0x33FFFFFF);

                logo.setBackground(background);
                logo.setElevation(1000f);

                FrameLayout.LayoutParams logoParams =
                        new FrameLayout.LayoutParams(
                                dp(85),
                                dp(85),
                                Gravity.BOTTOM | Gravity.LEFT
                        );

                logoParams.setMargins(
                        dp(16), 0, 0, dp(16)
                );

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
    }

    private int dp(int value) {
        return (int) (value * getResources()
                .getDisplayMetrics().density + 0.5f);
    }

    private void exitFullscreen() {
        if (customView == null) {
            return;
        }

        View oldView = customView;
        customView = null;

        getWindow().clearFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_VISIBLE
        );

        setContentView(webView);

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
        if (webView != null) {
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
