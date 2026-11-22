package com.gymfit.api;

import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static java.nio.charset.StandardCharsets.UTF_8;

@Configuration(proxyBeanMethods = false)
class MySqlConfiguration {
    private static final Set<String> TLS_MODES = Set.of("REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY");
    private static final String INVALID_URI = "Set DATABASE_URL to an Aiven MySQL URI with credentials and a database name.";

    @Bean
    HikariDataSource dataSource(@Value("${DATABASE_URL:}") String connectionString) {
        URI uri;
        try {
            uri = URI.create(connectionString);
        } catch (IllegalArgumentException ignored) {
            throw new IllegalArgumentException(INVALID_URI);
        }

        String[] credentials = uri.getRawUserInfo() == null ? new String[0] : uri.getRawUserInfo().split(":", 2);
        if (!"mysql".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null ||
                uri.getPath() == null || !uri.getPath().matches("/[A-Za-z0-9_-]+") ||
                credentials.length != 2 || credentials[0].isEmpty() || credentials[1].isEmpty()) {
            throw new IllegalArgumentException(INVALID_URI);
        }

        String mode = sslMode(uri);
        int port = uri.getPort() == -1 ? 3306 : uri.getPort();
        HikariDataSource source = new HikariDataSource();
        source.setJdbcUrl("jdbc:mysql://" + uri.getHost() + ":" + port + uri.getPath());
        source.setUsername(decode(credentials[0]));
        source.setPassword(decode(credentials[1]));
        source.addDataSourceProperty("sslMode", mode);
        source.addDataSourceProperty("connectTimeout", "5000");
        source.addDataSourceProperty("socketTimeout", "8000");
        source.setMaximumPoolSize(4);
        source.setConnectionTimeout(5000);
        return source;
    }

    private String sslMode(URI uri) {
        String query = uri.getRawQuery();
        if (query != null) {
            for (String parameter : query.split("&")) {
                String[] entry = parameter.split("=", 2);
                if ("ssl-mode".equals(decode(entry[0]))) {
                    String mode = entry.length == 2 ? decode(entry[1]).toUpperCase(Locale.ROOT) : "";
                    if (!TLS_MODES.contains(mode)) {
                        throw new IllegalArgumentException("MySQL ssl-mode must be REQUIRED, VERIFY_CA, or VERIFY_IDENTITY.");
                    }
                    return mode;
                }
            }
        }
        return "REQUIRED";
    }

    private String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), UTF_8);
    }
}
