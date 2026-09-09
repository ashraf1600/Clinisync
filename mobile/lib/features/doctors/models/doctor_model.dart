class DoctorModel {
  final String id;
  final String name;
  final String specialization;
  final String degrees;
  final String bmdcNumber;
  final String facility;
  final String chamber;
  final String? profilePhotoUrl;
  final String? bio;
  final double consultationFee;
  final double rating;
  final int experienceYears;

  DoctorModel({
    required this.id,
    required this.name,
    required this.specialization,
    required this.degrees,
    required this.bmdcNumber,
    required this.facility,
    required this.chamber,
    this.profilePhotoUrl,
    this.bio,
    required this.consultationFee,
    required this.rating,
    required this.experienceYears,
  });

  factory DoctorModel.fromJson(Map<String, dynamic> json) {
    return DoctorModel(
      id: json['id'] as String,
      name: json['name'] as String,
      specialization: json['specialization'] as String,
      degrees: json['degrees'] as String? ?? 'MBBS',
      bmdcNumber: json['bmdcNumber'] as String? ?? 'BMDC-PENDING',
      facility: json['facility'] as String? ?? 'Popular Diagnostic Centre',
      chamber: json['chamber'] as String? ?? 'Room #402',
      profilePhotoUrl: json['profilePhotoUrl'] as String?,
      bio: json['bio'] as String?,
      consultationFee: (json['consultationFee'] as num).toDouble(),
      rating: (json['rating'] as num?)?.toDouble() ?? 4.9,
      experienceYears: json['experienceYears'] as int? ?? 15,
    );
  }
}
