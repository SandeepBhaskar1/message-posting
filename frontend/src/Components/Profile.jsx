import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [newProfilePic, setNewProfilePic] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const BACKEND_URL = import.meta.env.MODE === 'production'
        ? import.meta.env.VITE_BACKEND_CLOUD_URL
        : import.meta.env.VITE_BACKEND_LOCAL_URL;

        console.log(BACKEND_URL);
        

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/user`, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        navigate('/login');
                    }
                    return;
                }

                const data = await response.json();
                setUserData(data.user);
            } catch (error) {
                console.error('Error fetching user data:', error);
                navigate('/login');
            }
        };

        fetchUserData();
    }, [navigate, BACKEND_URL]);

    const handleProfilePicUpload = async () => {
        if (!newProfilePic) {
            alert('Please select a profile picture to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('profilePic', newProfilePic);

        setIsUploading(true);

        try {
            const response = await fetch(`${BACKEND_URL}/uploadProfilePic`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setUserData((prevUserData) => ({
                    ...prevUserData,
                    profilePic: data.profilePicUrl, 
                }));
            } else {
                alert(data.message || 'Failed to upload profile picture');
            }
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            alert('An error occurred while uploading the profile picture.');
        } finally {
            setIsUploading(false);
        }
    };

    if (!userData) {
        return <div>Loading...</div>;
    }

    const profilePicUrl = userData.profilePic?.startsWith('http')
        ? userData.profilePic
        : `${BACKEND_URL}${userData.profilePic}`;

    return (
        <div className="p-4 flex space-x-8">
            <div className="flex-1">
                <h3 className="text-2xl font-bold mb-4">User Profile</h3>
                <div className="mb-4">
                    <p className="text-lg"><strong>Name:</strong> {userData.firstName} {userData.lastName}</p>
                    <p className="text-lg" ><strong>Date of Birth:</strong> {userData.dateOfBirth}</p>
                    <p className="text-lg"><strong>Email:</strong> {userData.emailID}</p>
                    <p className="text-lg"><strong>Gender:</strong> {userData.gender}</p>
                    <p className="text-lg"><strong>Contact Number:</strong> {userData.phoneNumber}</p>

                    <p className="text-lg"><strong>Joined on:</strong> {new Date(userData.createdAt).toLocaleDateString()}</p>
                </div>
            </div>

            <div className="flex-none text-center">
                <img
                    src={profilePicUrl || '/default-profile.jpg'}
                    alt="Profile"
                    className="w-40 h-40 rounded-full object-cover mb-4"
                />

                <div>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewProfilePic(e.target.files[0])}
                        className="mb-4"
                    />
                    <button
                        onClick={handleProfilePicUpload}
                        disabled={isUploading}
                        className={`bg-blue-500 text-white px-6 py-2 rounded ${isUploading ? 'bg-gray-400' : 'hover:bg-blue-600'}`}
                    >
                        {isUploading ? 'Uploading...' : 'Upload Profile Picture'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;