package com.wanzofc.xdpzq.models;

public class LoginResponse {
    public boolean success;
    public String message;
    public Data data;

    public static class Data {
        public String id;
        public String username;
        public String email;
        public String role;
        public boolean isPremium;
    }
}