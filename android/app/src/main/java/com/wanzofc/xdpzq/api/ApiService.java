package com.wanzofc.xdpzq.api;

import com.wanzofc.xdpzq.models.*;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface ApiService {
    @POST("/api/android/login")
    Call<LoginResponse> login(@Body LoginRequest request);

    @POST("/api/android/stats")
    Call<StatsResponse> getStats(@Body StatsRequest request);
   
    @POST("/api/android/register") 
    Call<LoginResponse> register(@Body RegisterRequest request);
}