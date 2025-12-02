package com.wanzofc.xdpzq.ui;

import android.os.Bundle;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.wanzofc.xdpzq.api.RetrofitClient;
import com.wanzofc.xdpzq.databinding.ActivityRegisterBinding;
import com.wanzofc.xdpzq.models.LoginResponse;
import com.wanzofc.xdpzq.models.RegisterRequest;
import com.wanzofc.xdpzq.utils.LoadingDialog;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {
    private ActivityRegisterBinding binding;
    private LoadingDialog loading;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityRegisterBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        loading = new LoadingDialog(this);

        binding.btnRegisterSubmit.setOnClickListener(v -> {
            RegisterRequest req = new RegisterRequest(
                binding.etRegUsername.getText().toString(),
                binding.etRegEmail.getText().toString(),
                binding.etRegPassword.getText().toString(),
                binding.etRegFullname.getText().toString(),
                binding.etRegPhone.getText().toString()
            );
            loading.show();
            RetrofitClient.getService().register(req).enqueue(new Callback<LoginResponse>() {
                @Override
                public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                    loading.dismiss();
                    if(response.isSuccessful() && response.body().success) {
                        Toast.makeText(RegisterActivity.this, "REGISTRASI BERHASIL", Toast.LENGTH_LONG).show();
                        finish();
                    } else Toast.makeText(RegisterActivity.this, "GAGAL REGISTRASI", Toast.LENGTH_SHORT).show();
                }
                @Override
                public void onFailure(Call<LoginResponse> call, Throwable t) {
                    loading.dismiss();
                    Toast.makeText(RegisterActivity.this, "error Network", Toast.LENGTH_SHORT).show();
                }
            });
        });
    }
}