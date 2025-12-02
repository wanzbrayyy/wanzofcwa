package com.wanzofc.xdpzq.ui;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import com.wanzofc.xdpzq.api.RetrofitClient;
import com.wanzofc.xdpzq.databinding.ActivityDashboardBinding;
import com.wanzofc.xdpzq.models.StatsRequest;
import com.wanzofc.xdpzq.models.StatsResponse;
import com.wanzofc.xdpzq.utils.SessionManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DashboardActivity extends AppCompatActivity {
    private ActivityDashboardBinding binding;
    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityDashboardBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        session = new SessionManager(this);

        if (!session.isLogin()) { logout(); return; }

        binding.tvUsername.setText(session.getUsername());
        binding.tvEmail.setText(session.getUserId());

        binding.btnLogout.setOnClickListener(v -> logout());
        binding.swipeRefresh.setOnRefreshListener(this::loadData);
        
        loadData();
    }

    private void loadData() {
        binding.swipeRefresh.setRefreshing(true);
        RetrofitClient.getService().getStats(new StatsRequest(session.getUserId())).enqueue(new Callback<StatsResponse>() {
            @Override
            public void onResponse(Call<StatsResponse> call, Response<StatsResponse> response) {
                binding.swipeRefresh.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null && response.body().success) {
                    StatsResponse.Data data = response.body().data;
                    binding.tvActiveBots.setText(String.valueOf(data.activeBot));
                    binding.tvLimit.setText(data.totalBot + " / " + data.limitBot);
                    
                    if(data.isPremium) {
                        binding.cardPremium.setCardBackgroundColor(Color.parseColor("#FFD700"));
                        binding.tvPremiumStatus.setText("PREMIUM MEMBER");
                        binding.tvPremiumStatus.setTextColor(Color.BLACK);
                    }
                }
            }
            @Override
            public void onFailure(Call<StatsResponse> call, Throwable t) {
                binding.swipeRefresh.setRefreshing(false);
            }
        });
    }

    private void logout() {
        session.logout();
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }
}