package com.wanzofc.xdpzq;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.wanzofc.xdpzq.api.RetrofitClient;
import com.wanzofc.xdpzq.databinding.ActivityDashboardBinding;
import com.wanzofc.xdpzq.models.StatsRequest;
import com.wanzofc.xdpzq.models.StatsResponse;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DashboardActivity extends AppCompatActivity {

    private ActivityDashboardBinding binding;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityDashboardBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        prefs = getSharedPreferences("wanzofc_sess", MODE_PRIVATE);
        String uid = prefs.getString("uid", null);
        String username = prefs.getString("username", "User");

        if (uid == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        binding.tvWelcome.setText("Hello, " + username);

        binding.btnRefresh.setOnClickListener(v -> loadData(uid));
        binding.btnLogout.setOnClickListener(v -> {
            prefs.edit().clear().apply();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });

        loadData(uid);
    }

    private void loadData(String uid) {
        binding.btnRefresh.setEnabled(false);
        RetrofitClient.getService().getStats(new StatsRequest(uid)).enqueue(new Callback<StatsResponse>() {
            @Override
            public void onResponse(Call<StatsResponse> call, Response<StatsResponse> response) {
                binding.btnRefresh.setEnabled(true);
                if (response.isSuccessful() && response.body() != null && response.body().success) {
                    StatsResponse.Data data = response.body().data;
                    binding.tvTotalBot.setText(data.totalBot + " / " + data.limitBot);
                    binding.tvActiveBot.setText(String.valueOf(data.activeBot));
                    
                    if (data.isPremium) {
                        binding.tvStatus.setText("PREMIUM");
                        binding.tvStatus.setTextColor(Color.parseColor("#FFEAA7"));
                    } else {
                        binding.tvStatus.setText("FREE PLAN");
                        binding.tvStatus.setTextColor(Color.WHITE);
                    }
                }
            }

            @Override
            public void onFailure(Call<StatsResponse> call, Throwable t) {
                binding.btnRefresh.setEnabled(true);
                Toast.makeText(DashboardActivity.this, "Sync Failed", Toast.LENGTH_SHORT).show();
            }
        });
    }
}