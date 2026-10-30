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
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;

public class MainActivity extends Activity {

    WebView webView;
    FrameLayout fullscreenLayout;
    View customView;
    WebChromeClient.CustomViewCallback customCallback;

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
                CustomViewCallback callback
            ) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }

                customView = view;
                customCallback = callback;

                getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN
                );

                getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                );

                fullscreenLayout = new FrameLayout(MainActivity.this);

                fullscreenLayout.addView(
                    customView,
                    new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                );

                // شعار Kora TV
                ImageView logo = new ImageView(MainActivity.this);
                logo.setImageResource(R.drawable.kora_icon);
                logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
                logo.setPadding(8, 8, 8, 8);

                GradientDrawable background = new GradientDrawable();
                background.setColor(0xCC000000);
                background.setCornerRadius(12);
                logo.setBackground(background);

                FrameLayout.LayoutParams logoParams =
                    new FrameLayout.LayoutParams(
                        85,
                        85,
                        Gravity.BOTTOM | Gravity.LEFT
                    );

                logoParams.setMargins(16, 0, 0, 16);

                fullscreenLayout.addView(logo, logoParams);

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

    private void exitFullscreen() {
        if (customView == null) return;

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
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            exitFullscreen();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
