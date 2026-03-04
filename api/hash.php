<?php
// Script to generate hashes
echo "admin123: " . password_hash("admin123", PASSWORD_BCRYPT) . "\n";
echo "bar123: " . password_hash("bar123", PASSWORD_BCRYPT) . "\n";
