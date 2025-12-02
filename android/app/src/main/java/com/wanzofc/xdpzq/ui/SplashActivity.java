package com.wanzofc.xdpzq.ui;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import androidx.appcompat.app.AppCompatActivity;
import com.wanzofc.xdpzq.utils.SessionManager;

public class SplashActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        new Handler().postDelayed(() -> {
            SessionManager session = new SessionManager(this);
            if (session.isLogin()) startActivity(new Intent(this, DashboardActivity.class));
            else startActivity(new Intent(this, LoginActivity.class));
            finish();
        }, 2000);
    }
}