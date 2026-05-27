package com.personal.inventory;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int CAMERA_PERMISSION_REQUEST = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraPhotoUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }

                fileCallback = filePathCallback;
                openFileChooser();
                return true;
            }
        });

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
        }

        webView.loadUrl("file:///android_asset/index.html");
    }

    private void openFileChooser() {
        Intent galleryIntent = new Intent(Intent.ACTION_GET_CONTENT);
        galleryIntent.addCategory(Intent.CATEGORY_OPENABLE);
        galleryIntent.setType("image/*");

        Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        try {
            File cameraDir = new File(getCacheDir(), "camera");
            if (!cameraDir.exists()) {
                cameraDir.mkdirs();
            }
            File photoFile = File.createTempFile("inventory-photo-", ".jpg", cameraDir);
            cameraPhotoUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);
            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
            cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (IOException error) {
            cameraIntent = null;
            cameraPhotoUri = null;
        }

        Intent chooser = Intent.createChooser(galleryIntent, "选择或拍摄照片");
        if (cameraIntent != null) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
        }
        startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) {
            return;
        }

        Uri[] results = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            } else if (cameraPhotoUri != null) {
                results = new Uri[]{cameraPhotoUri};
            }
        }

        fileCallback.onReceiveValue(results);
        fileCallback = null;
        cameraPhotoUri = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
