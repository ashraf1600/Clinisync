class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? phone;
  final String timezone;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phone,
    required this.timezone,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      phone: json['phone'] as String?,
      timezone: json['timezone'] as String? ?? 'Asia/Dhaka',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'role': role,
    'phone': phone,
    'timezone': timezone,
  };
}
