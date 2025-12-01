package com.wanzofc.xdpzq.models;

public class StatsResponse {
    public boolean success;
    public String message;
    public Data data;

    public static class Data {
        public String username;
        public int totalBot;
        public int activeBot;
        public int limitBot;
        public boolean isPremium;
    }
}