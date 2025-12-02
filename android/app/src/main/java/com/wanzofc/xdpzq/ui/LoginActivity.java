package com.wanzofc.xdpzq.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.wanzofc.xdpzq.api.RetrofitClient;
import com.wanzofc.xdpzq.databinding.ActivityLoginBinding;
import com.wanzofc.xdpzq.models.LoginRequest;
import com.wanzofc.xdpzq.models.LoginResponse;
import com.wanzofc.xdpzq.utils.LoadingDialog;
import com.wanzofc.xdpzq.utils.SessionManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {
    private ActivityLoginBinding binding;
    private LoadingDialog loading;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        loading = new LoadingDialog(this);

        binding.btnLogin.setOnClickListener(v -> handleLogin());
        binding.btnRegister.setOnClickListener(v -> startActivity(new Intent(this, RegisterActivity.class)));
    }

    private void handleLogin() {
        String email = binding.etEmail.getText().toString();
        String pass = binding.etPassword.getText().toString();
        
        loading.show();
        RetrofitClient.getService().login(new LoginRequest(email, pass)).enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                loading.dismiss();
                if (response.isSuccessful() && response.body() != null && response.body().success) {
                    new SessionManager(LoginActivity.this).createSession(
                        response.body().data.id,
                        response.body().data.username,
                        response.body().data.email
                    );
                    startActivity(new Intent(LoginActivity.this, DashboardActivity.class));
                    finish();
                } else {
                    Toast.makeText(LoginActivity.this, "LOGIN GAGAL", Toast.LENGTH_SHORT).show();
                }
            }
            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                loading.dismiss();
                Toast.makeText(LoginActivity.this, "NETWORK ERROR", Toast.LENGTH_SHORT).show();
            }
        });
    }
}