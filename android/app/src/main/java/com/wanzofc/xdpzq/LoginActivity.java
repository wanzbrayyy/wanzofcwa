package com.wanzofc.xdpzq;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.wanzofc.xdpzq.api.RetrofitClient;
import com.wanzofc.xdpzq.databinding.ActivityLoginBinding;
import com.wanzofc.xdpzq.models.LoginRequest;
import com.wanzofc.xdpzq.models.LoginResponse;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private ActivityLoginBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        SharedPreferences prefs = getSharedPreferences("wanzofc_sess", MODE_PRIVATE);
        if (prefs.contains("uid")) {
            startActivity(new Intent(this, DashboardActivity.class));
            finish();
        }

        binding.btnLogin.setOnClickListener(v -> {
            String email = binding.etEmail.getText().toString().trim();
            String pass = binding.etPassword.getText().toString().trim();

            if (email.isEmpty() || pass.isEmpty()) {
                Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show();
                return;
            }

            binding.btnLogin.setEnabled(false);
            binding.btnLogin.setText("Loading...");

            RetrofitClient.getService().login(new LoginRequest(email, pass)).enqueue(new Callback<LoginResponse>() {
                @Override
                public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                    binding.btnLogin.setEnabled(true);
                    binding.btnLogin.setText("LOGIN");

                    if (response.isSuccessful() && response.body() != null) {
                        if (response.body().success) {
                            SharedPreferences.Editor editor = prefs.edit();
                            editor.putString("uid", response.body().data.id);
                            editor.putString("username", response.body().data.username);
                            editor.apply();

                            startActivity(new Intent(LoginActivity.this, DashboardActivity.class));
                            finish();
                        } else {
                            Toast.makeText(LoginActivity.this, response.body().message, Toast.LENGTH_SHORT).show();
                        }
                    } else {
                        Toast.makeText(LoginActivity.this, "Connection Failed", Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<LoginResponse> call, Throwable t) {
                    binding.btnLogin.setEnabled(true);
                    binding.btnLogin.setText("LOGIN");
                    Toast.makeText(LoginActivity.this, "Error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        });
    }
}