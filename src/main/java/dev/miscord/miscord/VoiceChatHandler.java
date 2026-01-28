package dev.miscord.miscord;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class VoiceChatHandler implements WebSocketHandler {

    private final Map<String, WebSocketSession> sessionsById = new ConcurrentHashMap<>();
    private final Map<String, User> usersById = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessionsById.put(session.getId(), session);
        System.out.println("Yeni WebSocket bağlantısı kuruldu: " + session.getId());
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) {
        try {
            String payload = String.valueOf(message.getPayload());
            JsonNode jsonNode = objectMapper.readTree(payload);
            String messageType = jsonNode.get("type").asText();

            switch (messageType) {
                case "join" -> handleJoin(session, jsonNode);
                case "leave" -> handleLeave(session);
                case "mute" -> handleMute(session, true);
                case "unmute" -> handleMute(session, false);
                case "speaking" -> handleSpeaking(session, true);
                case "stop-speaking" -> handleSpeaking(session, false);

                // WebRTC signaling relay
                case "webrtc-offer", "webrtc-answer", "webrtc-ice" -> relayWebRtc(session, jsonNode);

                default -> { /* ignore */ }
            }
        } catch (Exception e) {
            System.err.println("Mesaj işleme hatası: " + e.getMessage());
        }
    }

    private void handleJoin(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String username = jsonNode.get("username").asText();
        String id = session.getId();

        User user = new User(id, username);
        usersById.put(id, user);

        sendUsersList(session);

        // diğerlerine bildir (exclude: join olan)
        broadcastUserJoined(user, session);

        System.out.println("Kullanıcı odaya katıldı: " + username + " (" + id + ")");
    }

    private void handleLeave(WebSocketSession session) throws IOException {
        String id = session.getId();
        User user = usersById.remove(id);
        if (user != null) {
            broadcastUserLeft(user.getId(), user.getUsername());
            System.out.println("Kullanıcı odadan ayrıldı: " + user.getUsername());
        }
    }

    private void handleMute(WebSocketSession session, boolean muted) throws IOException {
        User user = usersById.get(session.getId());
        if (user != null) {
            user.setStatus(muted ? "muted" : "online");
            broadcastUserStatusChanged(user.getId(), muted ? "user-muted" : "user-unmuted");
        }
    }

    private void handleSpeaking(WebSocketSession session, boolean speaking) throws IOException {
        User user = usersById.get(session.getId());
        if (user != null) {
            user.setStatus(speaking ? "speaking" : "online");
            broadcastUserStatusChanged(user.getId(), speaking ? "user-speaking" : "user-stopped-speaking");
        }
    }

    private void sendUsersList(WebSocketSession session) throws IOException {
        String selfId = session.getId();

        List<User> others = usersById.values().stream()
                .filter(u -> !u.getId().equals(selfId))
                .toList();

        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "users-list");
        msg.put("selfId", selfId);
        msg.put("users", others);

        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(msg)));
    }

    private void relayWebRtc(WebSocketSession fromSession, JsonNode jsonNode) throws IOException {
        JsonNode toNode = jsonNode.get("to");
        if (toNode == null || toNode.isNull()) return;

        String toId = toNode.asText();
        WebSocketSession target = sessionsById.get(toId);
        if (target == null || !target.isOpen()) return;

        Map<String, Object> relay = new HashMap<>();
        relay.put("type", jsonNode.get("type").asText());
        relay.put("from", fromSession.getId()); // spoof engeli
        relay.put("to", toId);

        if (jsonNode.has("sdp")) relay.put("sdp", objectMapper.treeToValue(jsonNode.get("sdp"), Object.class));
        if (jsonNode.has("candidate")) relay.put("candidate", objectMapper.treeToValue(jsonNode.get("candidate"), Object.class));

        target.sendMessage(new TextMessage(objectMapper.writeValueAsString(relay)));
    }

    private void broadcastUserJoined(User user, WebSocketSession excludeSession) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "user-joined");
        msg.put("user", user);
        broadcast(msg, excludeSession);
    }

    private void broadcastUserLeft(String id, String username) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "user-left");
        msg.put("id", id);
        msg.put("username", username);
        broadcast(msg, null);
    }

    private void broadcastUserStatusChanged(String id, String messageType) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", messageType);
        msg.put("id", id);
        broadcast(msg, null);
    }

    private void broadcast(Map<String, Object> message, WebSocketSession excludeSession) {
        try {
            String json = objectMapper.writeValueAsString(message);
            TextMessage textMessage = new TextMessage(json);

            for (WebSocketSession s : sessionsById.values()) {
                if (s != excludeSession && s.isOpen()) {
                    try { s.sendMessage(textMessage); }
                    catch (IOException e) { System.err.println("Mesaj gönderme hatası: " + e.getMessage()); }
                }
            }
        } catch (Exception e) {
            System.err.println("Broadcast hatası: " + e.getMessage());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.println("WebSocket transport hatası: " + exception.getMessage());
        cleanup(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        System.out.println("WebSocket bağlantısı kapandı: " + session.getId());
        cleanup(session);
    }

    private void cleanup(WebSocketSession session) throws IOException {
        String id = session.getId();
        sessionsById.remove(id);
        User user = usersById.remove(id);
        if (user != null) {
            broadcastUserLeft(user.getId(), user.getUsername());
        }
    }

    @Override
    public boolean supportsPartialMessages() {
        return false;
    }
}