package com.wanzofc.xdpzq.models;
public class LoginResponse {
    public boolean success;
    public String message;
    public Data data;
    public static class Data { public String id, username, email, role; public boolean isPremium; }
}