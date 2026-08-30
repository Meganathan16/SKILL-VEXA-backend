
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config();

const app = express();


// ======================================================
// SETTINGS
// ======================================================

const PORT = process.env.PORT || 3000;

const HOST = "0.0.0.0";


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


app.get("/", (req, res) => {
    res.json({
        success: true,
        project: "SKILLVEXA",
        message: "Backend is running"
    });
});


// ======================================================
// MYSQL CONNECTION
// ======================================================
//
// Railway MySQL credentials must be added to Render
// Environment Variables.
//
// Required variables:
//
// DB_HOST
// DB_PORT
// DB_USER
// DB_PASSWORD
// DB_NAME
//
// ======================================================

const db = mysql.createPool({

    host:
        process.env.DB_HOST,

    port:
        Number(process.env.DB_PORT) || 3306,

    user:
        process.env.DB_USER,

    password:
        process.env.DB_PASSWORD,

    database:
        process.env.DB_NAME,

    waitForConnections:
        true,

    connectionLimit:
        10,

    queueLimit:
        0

});


// ======================================================
// TEST MYSQL CONNECTION
// ======================================================

async function testDatabase() {

    let connection;

    try {

        connection =
            await db.getConnection();

        await connection.query(
            "SELECT 1"
        );

        console.log(
            "MySQL connected successfully."
        );

    }

    catch (error) {

        console.error(
            "MySQL connection failed:"
        );

        console.error(
            error.message
        );

    }

    finally {

        if (connection) {

            connection.release();

        }

    }

}


// ======================================================
// HOME / DASHBOARD
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                frontendPath,
                "dashboard.html"
            )
        );

    }
);


// ======================================================
// DASHBOARD API
// ======================================================

app.get(
    "/api/dashboard",
    async (req, res) => {

        try {

            // ------------------------------------------
            // GET DASHBOARD STATISTICS
            // ------------------------------------------

            const [stats] =
                await db.query(`

                    SELECT
                        total_students,
                        total_industries,
                        overall_skill_gap,
                        training_centres,
                        job_opportunities

                    FROM dashboard_stats

                    ORDER BY id DESC

                    LIMIT 1

                `);


            // ------------------------------------------
            // GET MOST DEMANDED SKILLS
            // ------------------------------------------

            const [skills] =
                await db.query(`

                    SELECT
                        skill_name,
                        demand_percentage

                    FROM demanded_skills

                    ORDER BY demand_percentage DESC

                `);


            // ------------------------------------------
            // SEND RESPONSE
            // ------------------------------------------

            res.json({

                success: true,

                stats:
                    stats.length > 0
                        ? stats[0]
                        : null,

                skills:
                    skills

            });

        }

        catch (error) {

            console.error(
                "Dashboard API Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load dashboard data."

            });

        }

    }
);


// =====================================================
// INDUSTRY PAGE
// =====================================================

app.get(
    "/industry",
    (req, res) => {

        res.sendFile(
            path.join(
                frontendPath,
                "industry.html"
            )
        );

    }
);


// =====================================================
// GET INDUSTRY REQUIREMENTS
// =====================================================

app.get(
    "/api/industry-requirements",
    async (req, res) => {

        try {

            const [industries] =
                await db.query(`

                    SELECT
                        id,
                        industry_name,
                        sector,
                        status

                    FROM industries

                    ORDER BY id DESC

                `);


            for (
                const industry of industries
            ) {

                const [skills] =
                    await db.query(`

                        SELECT
                            skill_name,
                            is_required

                        FROM industry_skills

                        WHERE industry_id = ?

                        ORDER BY id ASC

                    `, [
                        industry.id
                    ]);


                industry.skills =
                    skills;

            }


            res.json({

                success: true,

                industries:
                    industries

            });

        }

        catch (error) {

            console.error(
                "Industry requirements error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load industry requirements."

            });

        }

    }
);


// =====================================================
// GET SKILL DEMAND
// =====================================================

app.get(
    "/api/skill-demand",
    async (req, res) => {

        try {

            const [skills] =
                await db.query(`

                    SELECT
                        id,
                        skill_name,
                        demand_percentage,
                        industry_count

                    FROM skill_demand

                    ORDER BY demand_percentage DESC

                `);


            res.json({

                success: true,

                skills:
                    skills

            });

        }

        catch (error) {

            console.error(
                "Skill demand error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load skill demand."

            });

        }

    }
);


// =====================================================
// GET INDUSTRY SUMMARY
// =====================================================

app.get(
    "/api/industry-summary",
    async (req, res) => {

        try {

            const [[industryCount]] =
                await db.query(`

                    SELECT
                        COUNT(*) AS total_industries

                    FROM industries

                    WHERE status = 'Active'

                `);


            const [[skillCount]] =
                await db.query(`

                    SELECT
                        COUNT(DISTINCT skill_name)
                        AS total_skills

                    FROM industry_skills

                `);


            const [[highDemand]] =
                await db.query(`

                    SELECT
                        COUNT(*) AS high_demand_skills

                    FROM skill_demand

                    WHERE demand_percentage >= 70

                `);


            const [[industryResponses]] =
                await db.query(`

                    SELECT
                        COUNT(*) AS total_records

                    FROM industry_skills

                `);


            res.json({

                success: true,

                totalIndustries:
                    industryCount.total_industries,

                totalSkills:
                    skillCount.total_skills,

                highDemandSkills:
                    highDemand.high_demand_skills,

                industryResponses:
                    industryResponses.total_records

            });

        }

        catch (error) {

            console.error(
                "Industry summary error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load summary."

            });

        }

    }
);


// =====================================================
// ADD INDUSTRY REQUIREMENT
// =====================================================

app.post(
    "/api/industry-requirements",
    async (req, res) => {

        let connection;

        try {

            const {
                industry_name,
                sector,
                skills
            } = req.body;


            // ---------------------------------------------
            // VALIDATION
            // ---------------------------------------------

            if (
                !industry_name ||
                !sector ||
                !Array.isArray(skills)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Industry name, sector and skills are required."

                });

            }


            const validSkills =
                skills
                    .map(
                        skill =>
                            String(skill).trim()
                    )
                    .filter(
                        skill =>
                            skill.length > 0
                    );


            if (
                validSkills.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "At least one skill is required."

                });

            }


            connection =
                await db.getConnection();


            await connection.beginTransaction();


            // ---------------------------------------------
            // INSERT INDUSTRY
            // ---------------------------------------------

            const [industryResult] =
                await connection.query(`

                    INSERT INTO industries
                    (
                        industry_name,
                        sector,
                        status
                    )

                    VALUES (?, ?, 'Active')

                `, [

                    String(industry_name).trim(),

                    String(sector).trim()

                ]);


            const industryId =
                industryResult.insertId;


            // ---------------------------------------------
            // INSERT SKILLS
            // ---------------------------------------------

            for (
                const skillName of validSkills
            ) {

                await connection.query(`

                    INSERT INTO industry_skills
                    (
                        industry_id,
                        skill_name,
                        is_required
                    )

                    VALUES (?, ?, TRUE)

                `, [

                    industryId,

                    skillName

                ]);

            }


            await connection.commit();


            res.status(201).json({

                success: true,

                message:
                    "Industry requirement added successfully.",

                industryId:
                    industryId

            });

        }

        catch (error) {

            if (connection) {

                try {

                    await connection.rollback();

                }

                catch (rollbackError) {

                    console.error(
                        "Rollback error:",
                        rollbackError.message
                    );

                }

            }


            console.error(
                "Add industry error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to add industry requirement."

            });

        }

        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


// =====================================================
// DELETE INDUSTRY
// =====================================================

app.delete(
    "/api/industry-requirements/:id",
    async (req, res) => {

        try {

            const industryId =
                Number(req.params.id);


            if (
                !Number.isInteger(industryId) ||
                industryId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid industry ID."

                });

            }


            const [result] =
                await db.query(`

                    DELETE FROM industries

                    WHERE id = ?

                `, [

                    industryId

                ]);


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Industry not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Industry deleted successfully."

            });

        }

        catch (error) {

            console.error(
                "Delete industry error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to delete industry."

            });

        }

    }
);


// =====================================================
// STUDENT PROFILE
// =====================================================

app.post(
    "/api/student-profile",
    async (req, res) => {

        let connection;

        try {

            const {
                studentName,
                education,
                district,
                skills,
                interests,
                careerGoal
            } = req.body;


            // ---------------------------------------------
            // VALIDATION
            // ---------------------------------------------

            if (
                !studentName ||
                !education ||
                !district ||
                !careerGoal
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please fill all required fields."

                });

            }


            if (
                !Array.isArray(skills)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Skills must be an array."

                });

            }


            const validSkills =
                skills.filter(
                    skill =>
                        skill &&
                        skill.name &&
                        String(skill.name).trim()
                );


            if (
                validSkills.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please add at least one skill."

                });

            }


            connection =
                await db.getConnection();


            await connection.beginTransaction();


            // ---------------------------------------------
            // CREATE STUDENT PROFILE
            // ---------------------------------------------

            const [profileResult] =
                await connection.query(`

                    INSERT INTO student_profiles
                    (
                        student_name,
                        education,
                        district,
                        interests,
                        career_goal
                    )

                    VALUES (?, ?, ?, ?, ?)

                `, [

                    String(studentName).trim(),

                    String(education).trim(),

                    String(district).trim(),

                    interests
                        ? String(interests).trim()
                        : "",

                    String(careerGoal).trim()

                ]);


            const studentId =
                profileResult.insertId;


            // ---------------------------------------------
            // INSERT SKILLS
            // ---------------------------------------------

            const validLevels = [

                "Beginner",
                "Intermediate",
                "Advanced",
                "Expert"

            ];


            for (
                const skill of validSkills
            ) {

                const skillName =
                    String(skill.name).trim();


                const skillLevel =
                    validLevels.includes(
                        skill.level
                    )
                    ? skill.level
                    : "Beginner";


                await connection.query(`

                    INSERT INTO student_skills
                    (
                        student_id,
                        skill_name,
                        skill_level
                    )

                    VALUES (?, ?, ?)

                `, [

                    studentId,

                    skillName,

                    skillLevel

                ]);

            }


            await connection.commit();


            res.status(201).json({

                success: true,

                message:
                    "Student profile saved successfully.",

                studentId:
                    studentId

            });

        }

        catch (error) {

            if (connection) {

                try {

                    await connection.rollback();

                }

                catch (rollbackError) {

                    console.error(
                        "Rollback error:",
                        rollbackError.message
                    );

                }

            }


            console.error(
                "Student profile error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to save student profile."

            });

        }

        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


// =====================================================
// GET LATEST STUDENT PROFILE
// =====================================================

app.get(
    "/api/student-profile/latest",
    async (req, res) => {

        try {

            const [profiles] =
                await db.query(`

                    SELECT
                        id,
                        student_name,
                        education,
                        district,
                        interests,
                        career_goal

                    FROM student_profiles

                    ORDER BY id DESC

                    LIMIT 1

                `);


            if (
                profiles.length === 0
            ) {

                return res.json({

                    success: true,

                    profile: null

                });

            }


            const profile =
                profiles[0];


            const [skills] =
                await db.query(`

                    SELECT
                        skill_name AS name,
                        skill_level AS level

                    FROM student_skills

                    WHERE student_id = ?

                    ORDER BY id ASC

                `, [

                    profile.id

                ]);


            profile.skills =
                skills;


            res.json({

                success: true,

                profile:
                    profile

            });

        }

        catch (error) {

            console.error(
                "Load student profile error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load student profile."

            });

        }

    }
);


// =====================================================
// GET ALL STUDENT PROFILES
// =====================================================

app.get(
    "/api/student-profiles",
    async (req, res) => {

        try {

            const [students] =
                await db.query(`

                    SELECT
                        id,
                        student_name,
                        education,
                        district,
                        interests,
                        career_goal

                    FROM student_profiles

                    ORDER BY id DESC

                `);


            res.json({

                success: true,

                students:
                    students

            });

        }

        catch (error) {

            console.error(
                "Student profiles error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load student profiles"

            });

        }

    }
);


// =====================================================
// SKILL GAP ANALYSIS
// =====================================================

app.get(
    "/api/skill-gap/:studentId",
    async (req, res) => {

        try {

            const studentId =
                Number(req.params.studentId);


            if (
                !Number.isInteger(studentId) ||
                studentId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid student ID."

                });

            }


            // ----------------------------------------
            // GET STUDENT SKILLS
            // ----------------------------------------

            const [studentSkills] =
                await db.query(`

                    SELECT
                        skill_name,
                        skill_level

                    FROM student_skills

                    WHERE student_id = ?

                `, [

                    studentId

                ]);


            // ----------------------------------------
            // GET INDUSTRY SKILLS
            // ----------------------------------------

            const [industryRows] =
                await db.query(`

                    SELECT DISTINCT
                        skill_name

                    FROM industry_skills

                    WHERE is_required = 1

                `);


            const industrySkills =
                industryRows.map(
                    row =>
                        row.skill_name
                );


            // ----------------------------------------
            // FIND MISSING SKILLS
            // ----------------------------------------

            const studentSkillNames =
                studentSkills.map(
                    skill =>
                        String(
                            skill.skill_name
                        ).toLowerCase()
                );


            const missingSkills =
                industrySkills.filter(
                    skill =>
                        !studentSkillNames.includes(
                            String(skill).toLowerCase()
                        )
                );


            // ----------------------------------------
            // CALCULATE SKILL GAP
            // ----------------------------------------

            let skillGapPercentage = 0;


            if (
                industrySkills.length > 0
            ) {

                skillGapPercentage =
                    Math.round(
                        (
                            missingSkills.length /
                            industrySkills.length
                        ) * 100
                    );

            }


            // ----------------------------------------
            // RESPONSE
            // ----------------------------------------

            res.json({

                success: true,

                studentId:
                    studentId,

                industrySkills:
                    industrySkills,

                studentSkills:
                    studentSkills,

                missingSkills:
                    missingSkills,

                skillGapPercentage:
                    skillGapPercentage

            });

        }

        catch (error) {

            console.error(
                "Skill gap error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to calculate skill gap"

            });

        }

    }
);


// ============================================================
// TRAINING CENTRE APIs
// ============================================================


// ============================================================
// GET ALL TRAINING CENTRES WITH COURSES
// ============================================================

app.get(
    "/api/training-centres",
    async (req, res) => {

        try {

            const [centres] =
                await db.query(`

                    SELECT
                        id,
                        centre_name,
                        district,
                        state,
                        status

                    FROM training_centres

                    ORDER BY district ASC

                `);


            for (
                const centre of centres
            ) {

                const [courses] =
                    await db.query(`

                        SELECT
                            id,
                            course_name,
                            total_capacity,
                            available_seats

                        FROM training_centre_courses

                        WHERE centre_id = ?

                        ORDER BY course_name ASC

                    `, [

                        centre.id

                    ]);


                centre.courses =
                    courses;

            }


            res.json({

                success: true,

                centres:
                    centres

            });

        }

        catch (error) {

            console.error(
                "Training centre error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load training centres."

            });

        }

    }
);


// ============================================================
// GET TRAINING CAPACITY ANALYSIS
// ============================================================

app.get(
    "/api/training-capacity",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(`

                    SELECT
                        id,
                        skill_name,
                        industry_demand,
                        current_capacity,

                        GREATEST(
                            industry_demand -
                            current_capacity,
                            0
                        ) AS additional_need,

                        CASE

                            WHEN industry_demand >
                                 current_capacity

                            THEN 'Capacity Shortage'

                            WHEN industry_demand =
                                 current_capacity

                            THEN 'Fully Covered'

                            ELSE 'Capacity Available'

                        END AS capacity_status

                    FROM training_capacity_analysis

                    ORDER BY
                        additional_need DESC

                `);


            res.json({

                success: true,

                capacity:
                    rows

            });

        }

        catch (error) {

            console.error(
                "Capacity analysis error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load capacity analysis."

            });

        }

    }
);


// ============================================================
// TRAINING CENTRE SUMMARY
// ============================================================

app.get(
    "/api/training-summary",
    async (req, res) => {

        try {

            // ------------------------------------------
            // Total centres
            // ------------------------------------------

            const [centreRows] =
                await db.query(`

                    SELECT
                        COUNT(*) AS totalCentres

                    FROM training_centres

                    WHERE status = 'Active'

                `);


            // ------------------------------------------
            // Total training capacity
            // ------------------------------------------

            const [capacityRows] =
                await db.query(`

                    SELECT
                        COALESCE(
                            SUM(total_capacity),
                            0
                        ) AS totalCapacity

                    FROM training_centre_courses

                `);


            // ------------------------------------------
            // Total industry demand
            // ------------------------------------------

            const [demandRows] =
                await db.query(`

                    SELECT
                        COALESCE(
                            SUM(industry_demand),
                            0
                        ) AS industryDemand

                    FROM training_capacity_analysis

                `);


            // ------------------------------------------
            // Total additional requirement
            // ------------------------------------------

            const [needRows] =
                await db.query(`

                    SELECT
                        COALESCE(
                            SUM(
                                GREATEST(
                                    industry_demand -
                                    current_capacity,
                                    0
                                )
                            ),
                            0
                        ) AS additionalNeed

                    FROM training_capacity_analysis

                `);


            res.json({

                success: true,

                totalCentres:
                    centreRows[0].totalCentres,

                totalCapacity:
                    capacityRows[0].totalCapacity,

                industryDemand:
                    demandRows[0].industryDemand,

                additionalNeed:
                    needRows[0].additionalNeed

            });

        }

        catch (error) {

            console.error(
                "Training summary error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load training summary."

            });

        }

    }
);


// ============================================================
// CAREER PATH RECOMMENDATION
// ============================================================

app.get(
    "/api/career-recommendation/:studentId",
    async (req, res) => {

        try {

            const studentId =
                Number(req.params.studentId);


            if (
                !Number.isInteger(studentId) ||
                studentId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid student ID."

                });

            }


            const [recommendations] =
                await db.query(`

                    SELECT
                        scr.id,
                        c.id AS career_id,
                        c.career_name,
                        c.description,
                        scr.match_percentage

                    FROM student_career_recommendations scr

                    INNER JOIN careers c

                        ON scr.career_id = c.id

                    WHERE scr.student_id = ?

                    ORDER BY
                        scr.match_percentage DESC

                `, [

                    studentId

                ]);


            if (
                recommendations.length === 0
            ) {

                return res.json({

                    success: true,

                    recommendations: [],

                    message:
                        "No career recommendations found."

                });

            }


            const bestCareer =
                recommendations[0];


            // ------------------------------------------
            // Get required skills
            // ------------------------------------------

            const [skills] =
                await db.query(`

                    SELECT
                        career_id,
                        skill_name,
                        importance

                    FROM career_required_skills

                    WHERE career_id = ?

                    ORDER BY importance DESC

                `, [

                    bestCareer.career_id

                ]);


            // ------------------------------------------
            // Get training
            // ------------------------------------------

            const [training] =
                await db.query(`

                    SELECT
                        training_name,
                        duration

                    FROM career_training

                    WHERE career_id = ?

                `, [

                    bestCareer.career_id

                ]);


            res.json({

                success: true,

                recommendedCareer: {

                    career_id:
                        bestCareer.career_id,

                    career_name:
                        bestCareer.career_name,

                    description:
                        bestCareer.description,

                    match_percentage:
                        bestCareer.match_percentage,

                    required_skills:
                        skills,

                    training:
                        training

                },

                alternatives:
                    recommendations.slice(1)

            });

        }

        catch (error) {

            console.error(
                "Career recommendation error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load career recommendation."

            });

        }

    }
);


// ============================================================
// GET ALL CAREERS
// ============================================================

app.get(
    "/api/careers",
    async (req, res) => {

        try {

            const [careers] =
                await db.query(`

                    SELECT
                        id,
                        career_name,
                        description

                    FROM careers

                    ORDER BY career_name ASC

                `);


            res.json({

                success: true,

                careers:
                    careers

            });

        }

        catch (error) {

            console.error(
                "Careers error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load careers."

            });

        }

    }
);


// ============================================================
// GET CAREER DETAILS
// ============================================================

app.get(
    "/api/careers/:careerId",
    async (req, res) => {

        try {

            const careerId =
                Number(req.params.careerId);


            if (
                !Number.isInteger(careerId) ||
                careerId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid career ID."

                });

            }


            const [careerRows] =
                await db.query(`

                    SELECT
                        id,
                        career_name,
                        description

                    FROM careers

                    WHERE id = ?

                `, [

                    careerId

                ]);


            if (
                careerRows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Career not found."

                });

            }


            const [skills] =
                await db.query(`

                    SELECT
                        skill_name,
                        importance

                    FROM career_required_skills

                    WHERE career_id = ?

                    ORDER BY importance DESC

                `, [

                    careerId

                ]);


            const [training] =
                await db.query(`

                    SELECT
                        training_name,
                        duration

                    FROM career_training

                    WHERE career_id = ?

                `, [

                    careerId

                ]);


            res.json({

                success: true,

                career:
                    careerRows[0],

                skills:
                    skills,

                training:
                    training

            });

        }

        catch (error) {

            console.error(
                "Career details error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load career details."

            });

        }

    }
);


// =====================================================
// GOVERNMENT / DISTRICT ANALYTICS
// =====================================================


// =====================================================
// GET AVAILABLE DISTRICTS
// =====================================================

app.get(
    "/api/districts",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(`

                    SELECT DISTINCT
                        district

                    FROM district_analytics

                    ORDER BY district

                `);


            res.json({

                success: true,

                districts:
                    rows.map(
                        row =>
                            row.district
                    )

            });

        }

        catch (error) {

            console.error(
                "District loading error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load districts"

            });

        }

    }
);


// =====================================================
// GET ANALYTICS FOR SELECTED DISTRICT
// =====================================================

app.get(
    "/api/district-analytics",
    async (req, res) => {

        try {

            const district =
                (
                    req.query.district ||
                    "Chennai"
                ).trim();


            const [rows] =
                await db.query(`

                    SELECT
                        skill_name,
                        industry_demand,
                        student_skill_availability,

                        GREATEST(
                            industry_demand -
                            student_skill_availability,
                            0
                        ) AS skill_gap

                    FROM district_analytics

                    WHERE district = ?

                    ORDER BY skill_gap DESC

                `, [

                    district

                ]);


            res.json({

                success: true,

                district:
                    district,

                analytics:
                    rows

            });

        }

        catch (error) {

            console.error(
                "District analytics error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load district analytics"

            });

        }

    }
);


// =====================================================
// GOVERNMENT RECOMMENDATION FOR DISTRICT
// =====================================================

app.get(
    "/api/district-recommendation",
    async (req, res) => {

        try {

            const district =
                (
                    req.query.district ||
                    "Chennai"
                ).trim();


            const [rows] =
                await db.query(`

                    SELECT
                        skill_name,
                        industry_demand,
                        student_skill_availability,

                        GREATEST(
                            industry_demand -
                            student_skill_availability,
                            0
                        ) AS skill_gap

                    FROM district_analytics

                    WHERE district = ?

                    ORDER BY skill_gap DESC

                    LIMIT 3

                `, [

                    district

                ]);


            if (
                rows.length === 0
            ) {

                return res.json({

                    success: true,

                    district:
                        district,

                    recommendation:
                        "No analytics data available for this district.",

                    prioritySkills:
                        []

                });

            }


            const prioritySkills =
                rows.filter(
                    row =>
                        Number(row.skill_gap) >= 20
                );


            let recommendation = "";


            if (
                prioritySkills.length > 0
            ) {

                const skills =
                    prioritySkills
                        .map(
                            row =>
                                row.skill_name
                        )
                        .join(" and ");


                recommendation =
                    `Government should increase ${skills} training capacity in ${district} district.`;

            }

            else {

                recommendation =
                    `Skill demand and student availability are relatively balanced in ${district} district.`;

            }


            res.json({

                success: true,

                district:
                    district,

                recommendation:
                    recommendation,

                prioritySkills:
                    prioritySkills

            });

        }

        catch (error) {

            console.error(
                "District recommendation error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to generate recommendation"

            });

        }

    }
);


// =====================================================
// EMPLOYER DASHBOARD
// =====================================================


// =====================================================
// GET ALL EMPLOYER JOB ROLES
// =====================================================

app.get(
    "/api/employer-job-roles",
    async (req, res) => {

        try {

            const [roles] =
                await db.query(`

                    SELECT
                        id,
                        company_name,
                        job_role,
                        district,
                        created_at

                    FROM employer_job_roles

                    ORDER BY created_at DESC

                `);


            for (
                const role of roles
            ) {

                const [skills] =
                    await db.query(`

                        SELECT
                            id,
                            skill_name

                        FROM employer_job_skills

                        WHERE job_role_id = ?

                        ORDER BY id

                    `, [

                        role.id

                    ]);


                role.skills =
                    skills;

            }


            res.json({

                success: true,

                roles:
                    roles

            });

        }

        catch (error) {

            console.error(
                "Employer job roles error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load employer job roles."

            });

        }

    }
);


// =====================================================
// ADD EMPLOYER JOB ROLE
// =====================================================

app.post(
    "/api/employer-job-roles",
    async (req, res) => {

        let connection;

        try {

            const {
                company_name,
                job_role,
                district,
                skills
            } = req.body;


            if (
                !company_name ||
                !job_role ||
                !district ||
                !Array.isArray(skills)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Company, job role, district and skills are required."

                });

            }


            const validSkills =
                skills
                    .map(
                        skill =>
                            String(skill).trim()
                    )
                    .filter(
                        skill =>
                            skill.length > 0
                    );


            if (
                validSkills.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "At least one skill is required."

                });

            }


            connection =
                await db.getConnection();


            await connection.beginTransaction();


            // ------------------------------------------
            // INSERT JOB ROLE
            // ------------------------------------------

            const [result] =
                await connection.query(`

                    INSERT INTO employer_job_roles
                    (
                        company_name,
                        job_role,
                        district
                    )

                    VALUES (?, ?, ?)

                `, [

                    String(company_name).trim(),

                    String(job_role).trim(),

                    String(district).trim()

                ]);


            const jobRoleId =
                result.insertId;


            // ------------------------------------------
            // INSERT REQUIRED SKILLS
            // ------------------------------------------

            for (
                const skill of validSkills
            ) {

                await connection.query(`

                    INSERT INTO employer_job_skills
                    (
                        job_role_id,
                        skill_name
                    )

                    VALUES (?, ?)

                `, [

                    jobRoleId,

                    skill

                ]);

            }


            await connection.commit();


            res.status(201).json({

                success: true,

                message:
                    "Employer job role added successfully.",

                job_role_id:
                    jobRoleId

            });

        }

        catch (error) {

            if (connection) {

                try {

                    await connection.rollback();

                }

                catch (rollbackError) {

                    console.error(
                        "Rollback error:",
                        rollbackError.message
                    );

                }

            }


            console.error(
                "Add employer job role error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to add employer job role."

            });

        }

        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


// =====================================================
// SUBMIT EMPLOYER CANDIDATE FEEDBACK
// =====================================================

app.post(
    "/api/employer-feedback",
    async (req, res) => {

        try {

            const {
                job_role_id,
                weak_practical_skills,
                weak_python,
                weak_communication,
                no_project_experience,
                weak_problem_solving,
                additional_feedback
            } = req.body;


            if (!job_role_id) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Job role is required."

                });

            }


            await db.query(`

                INSERT INTO employer_feedback
                (
                    job_role_id,
                    weak_practical_skills,
                    weak_python,
                    weak_communication,
                    no_project_experience,
                    weak_problem_solving,
                    additional_feedback
                )

                VALUES (?, ?, ?, ?, ?, ?, ?)

            `, [

                job_role_id,

                Boolean(
                    weak_practical_skills
                ),

                Boolean(
                    weak_python
                ),

                Boolean(
                    weak_communication
                ),

                Boolean(
                    no_project_experience
                ),

                Boolean(
                    weak_problem_solving
                ),

                additional_feedback
                    ? String(
                        additional_feedback
                    ).trim()
                    : null

            ]);


            res.json({

                success: true,

                message:
                    "Employer feedback submitted successfully."

            });

        }

        catch (error) {

            console.error(
                "Employer feedback error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to submit employer feedback."

            });

        }

    }
);


// =====================================================
// EMPLOYER FEEDBACK BY DISTRICT
// =====================================================

app.get(
    "/api/employer-feedback-district",
    async (req, res) => {

        try {

            const district =
                (
                    req.query.district ||
                    ""
                ).trim();


            if (!district) {

                return res.status(400).json({

                    success: false,

                    message:
                        "District is required."

                });

            }


            const [rows] =
                await db.query(`

                    SELECT

                        COUNT(ef.id)
                        AS total_feedback,

                        COALESCE(
                            SUM(
                                ef.weak_practical_skills
                            ),
                            0
                        )
                        AS practical_skills,

                        COALESCE(
                            SUM(
                                ef.weak_python
                            ),
                            0
                        )
                        AS python,

                        COALESCE(
                            SUM(
                                ef.weak_communication
                            ),
                            0
                        )
                        AS communication,

                        COALESCE(
                            SUM(
                                ef.no_project_experience
                            ),
                            0
                        )
                        AS project_experience,

                        COALESCE(
                            SUM(
                                ef.weak_problem_solving
                            ),
                            0
                        )
                        AS problem_solving

                    FROM employer_feedback ef

                    INNER JOIN employer_job_roles ejr

                        ON ejr.id =
                           ef.job_role_id

                    WHERE ejr.district = ?

                `, [

                    district

                ]);


            const data =
                rows[0];


            const total =
                Number(
                    data.total_feedback
                );


            function percentage(value) {

                if (
                    total === 0
                ) {

                    return 0;

                }


                return Math.round(
                    (
                        Number(value) /
                        total
                    ) * 100
                );

            }


            const insights = [

                {
                    skill:
                        "Practical Skills",

                    percentage:
                        percentage(
                            data.practical_skills
                        )
                },

                {
                    skill:
                        "Python",

                    percentage:
                        percentage(
                            data.python
                        )
                },

                {
                    skill:
                        "Communication",

                    percentage:
                        percentage(
                            data.communication
                        )
                },

                {
                    skill:
                        "Project Experience",

                    percentage:
                        percentage(
                            data.project_experience
                        )
                },

                {
                    skill:
                        "Problem Solving",

                    percentage:
                        percentage(
                            data.problem_solving
                        )
                }

            ];


            insights.sort(
                (a, b) =>
                    b.percentage -
                    a.percentage
            );


            res.json({

                success: true,

                district:
                    district,

                total_feedback:
                    total,

                insights:
                    insights

            });

        }

        catch (error) {

            console.error(
                "District employer feedback error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load district employer feedback."

            });

        }

    }
);


// =====================================================
// EMPLOYER FEEDBACK INSIGHTS
// =====================================================

app.get(
    "/api/employer-feedback-insights",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(`

                    SELECT

                        COUNT(*)
                        AS total_feedback,

                        COALESCE(
                            SUM(
                                weak_practical_skills
                            ),
                            0
                        )
                        AS practical_skills,

                        COALESCE(
                            SUM(
                                weak_python
                            ),
                            0
                        )
                        AS python,

                        COALESCE(
                            SUM(
                                weak_communication
                            ),
                            0
                        )
                        AS communication,

                        COALESCE(
                            SUM(
                                no_project_experience
                            ),
                            0
                        )
                        AS project_experience,

                        COALESCE(
                            SUM(
                                weak_problem_solving
                            ),
                            0
                        )
                        AS problem_solving

                    FROM employer_feedback

                `);


            const data =
                rows[0];


            const total =
                Number(
                    data.total_feedback
                );


            function percentage(value) {

                if (
                    total === 0
                ) {

                    return 0;

                }


                return Math.round(
                    (
                        Number(value) /
                        total
                    ) * 100
                );

            }


            const insights = [

                {
                    skill:
                        "Practical Skills",

                    percentage:
                        percentage(
                            data.practical_skills
                        )
                },

                {
                    skill:
                        "Python",

                    percentage:
                        percentage(
                            data.python
                        )
                },

                {
                    skill:
                        "Communication",

                    percentage:
                        percentage(
                            data.communication
                        )
                },

                {
                    skill:
                        "Project Experience",

                    percentage:
                        percentage(
                            data.project_experience
                        )
                },

                {
                    skill:
                        "Problem Solving",

                    percentage:
                        percentage(
                            data.problem_solving
                        )
                }

            ];


            insights.sort(
                (a, b) =>
                    b.percentage -
                    a.percentage
            );


            res.json({

                success: true,

                total_feedback:
                    total,

                insights:
                    insights

            });

        }

        catch (error) {

            console.error(
                "Employer feedback insights error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to load employer feedback insights."

            });

        }

    }
);


// =====================================================
// DATABASE TEST
// =====================================================

app.get(
    "/api/test",
    async (req, res) => {

        try {

            const [result] =
                await db.query(
                    "SELECT 1 AS connected"
                );


            res.json({

                success: true,

                message:
                    "SKILLVEXA MySQL connection is working.",

                database:
                    result[0].connected === 1

            });

        }

        catch (error) {

            console.error(
                "Database Test Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "MySQL connection failed.",

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            project:
                "SKILLVEXA",

            status:
                "Backend is running",

            frontend:
                "Connected"

        });

    }
);


// =====================================================
// 404 HANDLER
// =====================================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "SKILLVEXA API route not found."

        });

    }
);


// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Unhandled server error:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(error);

        }


        res.status(500).json({

            success: false,

            message:
                "Internal server error."

        });

    }
);


// ======================================================
// START SERVER
// ======================================================

app.listen(
    PORT,
    HOST,
    async () => {

        console.log("");
        console.log(
            "=========================================="
        );

        console.log(
            "          SKILLVEXA SERVER"
        );

        console.log(
            "=========================================="
        );

        console.log(
            `Server running on port: ${PORT}`
        );

        console.log(
            `Frontend path: ${frontendPath}`
        );

        console.log(
            "=========================================="
        );

        console.log("");

        await testDatabase();

    }
);

