package dev.miscord.miscord;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final VoiceChatHandler voiceChatHandler;

    public WebSocketConfig(VoiceChatHandler voiceChatHandler) {
        this.voiceChatHandler = voiceChatHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(voiceChatHandler, "/voice-chat")
                .setAllowedOrigins("*");
    }
}